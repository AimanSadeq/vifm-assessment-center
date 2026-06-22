// Demo-data module for Succession Readiness (Persona self + Reflect 360 others
// vs a target role). Seeds a COMBINED-mode engagement whose candidates are bound
// to a seeded role profile (Senior Government Manager - the SDAIA-flavoured GCC
// government fit), then seeds Persona (behavioral) self-scores so the live
// readiness engine produces a real tier per candidate.
//
// Why this shape: the readiness REPORT page + the talent-map cohort panel call
// `computeCandidateReadiness` LIVE - they do not read a pre-stored snapshot. With
// no 360 evidence the engine's Persona-as-driver fallback (SD-2) drives the tier
// from `behavioral_competency_scores`, so seeding those rows is enough to make
// /admin/engagements/[id]/talent-map and the per-candidate readiness report
// populate end-to-end. We ALSO best-effort upsert `readiness_results` snapshots
// so any surface that reads the stored table is populated too.
//
// Dependency note: a fully populated 360 "Others" view would additionally need
// Reflect participants + responses (a separate service). This module deliberately
// seeds the Persona-only path (self-reported, labelled as such in the report) so
// it stands alone; the cohort still shows Ready Now / Developing / Not Ready.
//
// This is its OWN engagement (distinct name), separate from the inline AC seeder's
// engagement, so the two never collide and purge can scope cleanly by name.

import type { DemoServiceModule, DemoSb, DemoOrgIds } from "./types";
import { DEMO_TAG, DEMO_EMAIL_DOMAIN, type DemoSeedOutcome, type DemoServiceCount } from "../constants";

const SERVICE = "readiness";
const LABEL = "Succession Readiness";

// Distinct engagement name so it never collides with the inline AC demo engagement.
const ENG_NAME = `${DEMO_TAG} Najm Capital - Director Succession Pool`;
const TARGET_ROLE = "Senior Government Manager";

// Seeded global role profile (migration 00015) - 9 competencies across all 4
// VIFM domains, default target proficiency 4. Best fit for a GCC government pool.
const ROLE_PROFILE_ID = "00000001-aaaa-0000-0000-000000000005";

// Role competencies (subset of the seeded role profile) with their VIFM domain so
// the self-scores below land sensible 9-box quadrants. Target = 4 (role default).
// Integrity is the high-priority knockout competency in the seeded profile.
const ROLE_COMPS: { id: string; name: string; axis: "perf" | "pot"; knockout?: boolean }[] = [
  { id: "a0000001-0000-0000-0000-000000000001", name: "Strategic Mindset", axis: "pot" },
  { id: "a0000001-0000-0000-0000-000000000005", name: "Decision Quality", axis: "pot" },
  { id: "a0000001-0000-0000-0000-000000000018", name: "Drives Vision and Purpose", axis: "perf" },
  { id: "a0000001-0000-0000-0000-000000000019", name: "Communicates Effectively", axis: "perf" },
  { id: "a0000001-0000-0000-0000-000000000024", name: "Develops Talent", axis: "perf" },
  { id: "a0000001-0000-0000-0000-000000000020", name: "Persuades", axis: "perf" },
  { id: "a0000001-0000-0000-0000-000000000021", name: "Manages Conflict", axis: "perf" },
  { id: "a0000001-0000-0000-0000-000000000032", name: "Integrity", axis: "pot", knockout: true },
  { id: "a0000001-0000-0000-0000-000000000033", name: "Cultural Sensitivity", axis: "pot" },
];

const TARGET = 4; // role_profiles.default_target_proficiency for this profile

type Tier = "ready_now" | "ready_soon" | "developing" | "not_ready";

// Three candidates engineered to land distinct, demo-friendly tiers under the
// engine's default config (target 4, knockout on a high-priority comp ≥1.0 below
// target caps the tier at "developing"). Each value is the candidate's self-rating
// (1-5) for the matching ROLE_COMPS entry, in the same order.
const CANDIDATES: {
  name: string;
  email: string;
  status: "completed" | "in_progress";
  selfByComp: number[]; // aligned 1:1 with ROLE_COMPS
}[] = [
  {
    // Meets/exceeds the bar across the board → Ready Now.
    name: "Hessa Al Mutairi",
    email: `hessa.almutairi@${DEMO_EMAIL_DOMAIN}`,
    status: "completed",
    //          SM  DQ  DV  CE  DT  PE  MC  IN  CS
    selfByComp: [4, 4, 5, 4, 4, 4, 4, 5, 4],
  },
  {
    // Moderate gaps to the bar → Developing.
    name: "Saeed Al Ghamdi",
    email: `saeed.alghamdi@${DEMO_EMAIL_DOMAIN}`,
    status: "completed",
    //          SM  DQ  DV  CE  DT  PE  MC  IN  CS
    selfByComp: [3, 3, 4, 3, 3, 3, 3, 4, 3],
  },
  {
    // Substantial gaps AND a knockout miss on Integrity (high priority, ≥1.0 below
    // target) → capped at Not Ready / Developing - a clean talking point for the demo.
    name: "Mona Al Harthi",
    email: `mona.alharthi@${DEMO_EMAIL_DOMAIN}`,
    status: "completed",
    //          SM  DQ  DV  CE  DT  PE  MC  IN  CS
    selfByComp: [3, 2, 3, 3, 2, 2, 2, 2, 3],
  },
];

const r2 = (n: number) => Math.round(n * 100) / 100;

// ──────────────── pure engine mirror (for the snapshot only) ─────────────────
// We do not import the scoring engine here (keep the seeder dependency-free, like
// the cognitive module). We compute a simple weighted-mean tier purely so the
// readiness_results snapshot we store is internally consistent with the live
// engine's default-config behaviour. The LIVE report/cohort recompute from the
// Persona scores regardless, so this snapshot is belt-and-braces only.
function tierFromMean(mean: number): Tier {
  const gap = mean - TARGET; // unit weights, every target = 4
  if (gap >= 0) return "ready_now";
  if (gap >= -0.5) return "ready_soon";
  if (gap >= -1.0) return "developing";
  return "not_ready";
}

function snapshotFor(selfByComp: number[]) {
  const per = ROLE_COMPS.map((c, i) => ({
    competencyId: c.id,
    name: c.name,
    weight: 1,
    priority: c.knockout ? "high" : "medium",
    target: TARGET,
    domain: c.axis === "perf" ? "RESULTS" : "THINKING",
    othersMean: selfByComp[i],
    gap: r2(selfByComp[i] - TARGET),
    covered: true,
    knockoutTriggered: !!c.knockout && selfByComp[i] <= TARGET - 1.0,
    selfMean: null,
    selfOthersGap: null,
    selfFlag: null,
    lowAgreement: false,
  }));
  const mean = per.reduce((a, p) => a + (p.othersMean as number), 0) / per.length;
  let tier = tierFromMean(mean);
  const knockout = per.some((p) => p.knockoutTriggered);
  if (knockout && (tier === "ready_now" || tier === "ready_soon")) tier = "developing";
  return {
    tier,
    weightedOthers: r2(mean),
    weightedTarget: TARGET,
    overallGap: r2(mean - TARGET),
    knockoutApplied: knockout,
    per,
  };
}

// ───────────────────────────────────── helpers ───────────────────────────────
async function findEngagementId(sb: DemoSb, orgId: string): Promise<string | null> {
  const res = await sb
    .from("engagements")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", ENG_NAME)
    .maybeSingle();
  return (res.data?.id as string) ?? null;
}

// ───────────────────────────────────── seed ──────────────────────────────────
async function seed(sb: DemoSb, org: DemoOrgIds): Promise<DemoSeedOutcome> {
  // Idempotency: skip if our combined-mode engagement already exists.
  const existingId = await findEngagementId(sb, org.organizationId);
  if (existingId) return { service: SERVICE, label: LABEL, created: 0, note: "already present" };

  // 1) Combined-mode engagement (the Readiness service front door creates exactly
  //    this shape; assessment_mode may not be migrated on a fresh DB, so retry without it).
  let eng = await sb
    .from("engagements")
    .insert({
      organization_id: org.organizationId,
      name: ENG_NAME,
      target_role: TARGET_ROLE,
      status: "active",
      assessment_mode: "combined",
    })
    .select("id")
    .single();
  if (eng.error) {
    eng = await sb
      .from("engagements")
      .insert({
        organization_id: org.organizationId,
        name: ENG_NAME,
        target_role: TARGET_ROLE,
        status: "active",
      })
      .select("id")
      .single();
  }
  if (eng.error || !eng.data) throw new Error(`Readiness engagement: ${eng.error?.message}`);
  const engId = eng.data.id as string;

  // 2) Candidates bound to the role profile (role_profile_id from migration 00016).
  const candRes = await sb
    .from("candidates")
    .insert(
      CANDIDATES.map((c) => ({
        engagement_id: engId,
        full_name: c.name,
        email: c.email,
        status: c.status,
        role_profile_id: ROLE_PROFILE_ID,
      })),
    )
    .select("id");
  if (candRes.error || !candRes.data) throw new Error(`Readiness candidates: ${candRes.error?.message}`);
  const candidateIds = (candRes.data as { id: string }[]).map((r) => r.id);

  // 3) Persona (behavioral) self-scores - the readiness engine's driver when no 360
  //    exists. One row per (engagement, candidate, competency). self_score is
  //    numeric(3,2) NOT NULL, item_count smallint NOT NULL (migration 00094).
  const bxRows: Record<string, unknown>[] = [];
  CANDIDATES.forEach((c, ci) => {
    ROLE_COMPS.forEach((comp, i) => {
      bxRows.push({
        engagement_id: engId,
        candidate_id: candidateIds[ci],
        competency_id: comp.id,
        self_score: c.selfByComp[i],
        item_count: 4,
      });
    });
  });
  let bxNote = "Persona self-scores seeded";
  const bx = await sb.from("behavioral_competency_scores").insert(bxRows);
  if (bx.error) {
    // behavioral_competency_scores not migrated - the engine then returns
    // insufficient_data, but the engagement + role binding still demo the setup.
    bxNote = `Persona self-scores skipped (${bx.error.message})`;
  }

  // 4) Best-effort readiness_results snapshots (migration 00091). The live report
  //    recomputes regardless; this populates any snapshot-reading surface too.
  let snapNote = "snapshots stored";
  try {
    const rows = CANDIDATES.map((c, ci) => {
      const s = snapshotFor(c.selfByComp);
      return {
        engagement_id: engId,
        candidate_id: candidateIds[ci],
        role_profile_id: ROLE_PROFILE_ID,
        status: s.tier,
        tier: s.tier,
        weighted_others: s.weightedOthers,
        weighted_target: s.weightedTarget,
        overall_gap: s.overallGap,
        coverage_pct: 1,
        knockout_applied: s.knockoutApplied,
        per_competency: s.per,
        config_snapshot: { source: "demo-seed", target: TARGET },
      };
    });
    const snap = await sb
      .from("readiness_results")
      .upsert(rows, { onConflict: "engagement_id,candidate_id" });
    if (snap.error) snapNote = `snapshots skipped (${snap.error.message})`;
  } catch (e) {
    snapNote = `snapshots skipped (${e instanceof Error ? e.message : String(e)})`;
  }

  return {
    service: SERVICE,
    label: LABEL,
    created: 1,
    note: `combined engagement + 3 candidates vs ${TARGET_ROLE}; ${bxNote}; ${snapNote}`,
  };
}

// ──────────────────────────────────── purge ──────────────────────────────────
async function purge(sb: DemoSb, org: DemoOrgIds): Promise<string> {
  const engId = await findEngagementId(sb, org.organizationId);
  if (!engId) return "no readiness engagement";

  // Children first, then the candidates, then the engagement. Each delete is
  // best-effort: a missing table (un-applied migration) must not abort the rest.
  await sb.from("readiness_results").delete().eq("engagement_id", engId);
  await sb.from("behavioral_competency_scores").delete().eq("engagement_id", engId);
  // behavioral_assessment_sessions cascade their responses; delete defensively in
  // case a future surface seeds them (none here, but keep purge complete).
  await sb.from("behavioral_assessment_sessions").delete().eq("engagement_id", engId);
  // No reflect_idps to clean: the Persona-only demo path never creates a Reflect
  // participant, and reflect_idps is keyed by participant (not engagement) anyway.
  await sb.from("candidates").delete().eq("engagement_id", engId);
  const del = await sb.from("engagements").delete().eq("id", engId);
  if (del.error) throw new Error(del.error.message);
  return "readiness engagement removed (1)";
}

// ──────────────────────────────────── count ──────────────────────────────────
async function count(sb: DemoSb, org: DemoOrgIds): Promise<DemoServiceCount | null> {
  try {
    const engId = await findEngagementId(sb, org.organizationId);
    if (!engId) return { service: SERVICE, label: LABEL, count: 0 };
    // Count candidates in the readiness engagement (the unit the panel cares about).
    const res = await sb
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("engagement_id", engId);
    if (res.error) return null;
    return { service: SERVICE, label: LABEL, count: res.count ?? 0 };
  } catch {
    return null;
  }
}

const readinessModule: DemoServiceModule = { id: SERVICE, label: LABEL, seed, purge, count };
export default readinessModule;
