// Demo-data purge (service-role). Removes ONLY demo-tagged rows: everything that
// hangs off the demo org, plus sentinel-named global rows (demo exercises, the
// demo assessor). FK-safe order: children before parents; the org stores last,
// once every service's rows are gone. Tolerant - a per-service failure is
// reported, not thrown, so the rest still purge.

import { createServiceClient } from "@/lib/supabase/server";
import { DEMO_ORG_NAME, DEMO_TAG, DEMO_EMAIL_DOMAIN } from "./constants";
import { DEMO_SERVICE_MODULES } from "./services";

type Sb = ReturnType<typeof createServiceClient>;

async function findDemoOrgIds(sb: Sb): Promise<{ organizationId: string | null; araOrganizationId: string | null }> {
  const [ac, ara] = await Promise.all([
    sb.from("organizations").select("id").eq("name", DEMO_ORG_NAME).maybeSingle(),
    sb.from("ara_organizations").select("id").eq("name", DEMO_ORG_NAME).maybeSingle(),
  ]);
  return { organizationId: (ac.data?.id as string) ?? null, araOrganizationId: (ara.data?.id as string) ?? null };
}

const ids = (rows: { id: string }[] | null) => (rows ?? []).map((r) => r.id);

// ─────────────────────────────────── Fluent ──────────────────────────────────
async function purgeFluent(sb: Sb, orgId: string): Promise<string> {
  const r = await sb.from("eng_fluent_results").delete().eq("organization_id", orgId);
  if (r.error) throw new Error(r.error.message);
  return "fluent results removed";
}

// ─────────────────────────────────── Pre-Hire ────────────────────────────────
async function purgePrehire(sb: Sb, orgId: string): Promise<string> {
  const reqRes = await sb.from("prehire_requisitions").select("id").eq("organization_id", orgId);
  const reqIds = ids(reqRes.data as { id: string }[] | null);
  if (reqIds.length) {
    const candRes = await sb.from("prehire_candidates").select("id").in("requisition_id", reqIds);
    const candIds = ids(candRes.data as { id: string }[] | null);
    if (candIds.length) await sb.from("prehire_stage_results").delete().in("prehire_candidate_id", candIds);
    await sb.from("prehire_audit_log").delete().in("requisition_id", reqIds);
    await sb.from("prehire_candidates").delete().in("requisition_id", reqIds);
    await sb.from("prehire_requisitions").delete().in("id", reqIds);
  }
  return `requisitions removed (${reqIds.length})`;
}

// ───────────────────────────── Assessment Center ─────────────────────────────
async function purgeAssessmentCenter(sb: Sb, orgId: string): Promise<string> {
  const engRes = await sb.from("engagements").select("id").eq("organization_id", orgId);
  const engIds = ids(engRes.data as { id: string }[] | null);
  if (engIds.length) {
    const asg = await sb.from("assessor_assignments").select("id").in("engagement_id", engIds);
    const asgIds = ids(asg.data as { id: string }[] | null);
    if (asgIds.length) {
      await sb.from("observations").delete().in("assessor_assignment_id", asgIds);
      await sb.from("ratings").delete().in("assessor_assignment_id", asgIds);
    }
    await sb.from("candidate_reports").delete().in("engagement_id", engIds);
    await sb.from("overall_assessment_ratings").delete().in("engagement_id", engIds);
    await sb.from("consensus_ratings").delete().in("engagement_id", engIds);
    await sb.from("integration_worksheets").delete().in("engagement_id", engIds);
    await sb.from("assessor_assignments").delete().in("engagement_id", engIds);
    await sb.from("engagement_competencies").delete().in("engagement_id", engIds);
    await sb.from("engagement_exercises").delete().in("engagement_id", engIds);
    await sb.from("exercise_competency_matrix").delete().in("engagement_id", engIds);
    await sb.from("candidates").delete().in("engagement_id", engIds);
    await sb.from("engagements").delete().in("id", engIds);
  }
  await sb.from("exercises").delete().ilike("name", `${DEMO_TAG}%`);
  return `engagements removed (${engIds.length})`;
}

/** Delete the demo assessor we provisioned (sentinel email only - never an
 *  existing real assessor). */
async function purgeDemoPeople(sb: Sb): Promise<string> {
  const prof = await sb.from("profiles").select("id").ilike("email", `%@${DEMO_EMAIL_DOMAIN}`);
  const rows = (prof.data ?? []) as { id: string }[];
  for (const p of rows) {
    await sb.from("profiles").delete().eq("id", p.id);
    try {
      await sb.auth.admin.deleteUser(p.id);
    } catch {
      /* auth user may already be gone */
    }
  }
  return `demo people removed (${rows.length})`;
}

async function deleteDemoOrgs(sb: Sb, orgId: string | null, araOrgId: string | null): Promise<string> {
  let removed = 0;
  if (orgId) {
    const r = await sb.from("organizations").delete().eq("id", orgId);
    if (!r.error) removed++;
  }
  if (araOrgId) {
    const r = await sb.from("ara_organizations").delete().eq("id", araOrgId);
    if (!r.error) removed++;
  }
  return `org stores removed (${removed})`;
}

export type DemoPurgeOutcome = { step: string; ok: boolean; note: string };

export async function purgeDemoData(): Promise<DemoPurgeOutcome[]> {
  const sb = createServiceClient();
  const { organizationId, araOrganizationId } = await findDemoOrgIds(sb);
  const out: DemoPurgeOutcome[] = [];
  const step = async (name: string, fn: () => Promise<string>) => {
    try {
      out.push({ step: name, ok: true, note: await fn() });
    } catch (e) {
      out.push({ step: name, ok: false, note: e instanceof Error ? e.message : String(e) });
    }
  };

  if (organizationId) {
    // Per-service modules first - some (e.g. Academy enrolments, Readiness) point
    // at the AC candidates we are about to delete.
    const org = { organizationId, araOrganizationId: araOrganizationId ?? "" };
    for (const m of [...DEMO_SERVICE_MODULES].reverse()) await step(m.label, () => m.purge(sb, org));
    // Then the inline subtrees. Children of the org first (Fluent results FK to
    // candidates we are about to delete; Pre-Hire and AC are independent subtrees).
    await step("Fluent", () => purgeFluent(sb, organizationId));
    await step("Pre-Hire", () => purgePrehire(sb, organizationId));
    await step("Assessment Center", () => purgeAssessmentCenter(sb, organizationId));
  }
  await step("Demo people", () => purgeDemoPeople(sb));
  await step("Organisation", () => deleteDemoOrgs(sb, organizationId, araOrganizationId));
  return out;
}
