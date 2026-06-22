// Reflect 360 demo-data module. Seeds one realistic GCC-bank leadership-360
// engagement so /reflect/consultant + the engagement detail / participant
// report screens populate for a BD pitch.
//
// Shape of what we create (all hung off the demo ARA org so purge can find it):
//   reflect_engagements  (1, status=live)
//     reflect_frameworks (1, cloned from the seeded "VIFM Leadership
//        Essentials" library template -> reads exactly like a real engagement)
//       reflect_competencies + reflect_behaviors (copied from the template)
//     reflect_participants (2)
//       reflect_raters (self + manager + 3 peers per participant)
//         reflect_responses (one score per rater x behaviour)
//
// Scoring is computed at read-time from reflect_responses (no stored score
// columns), so populated responses are enough to make the participant report
// and cohort screens render real numbers. The first participant is fully
// scored (every rater answered every behaviour); the second is partially
// answered so the dashboard shows an in-progress engagement realistically.

import type { DemoServiceModule, DemoSb, DemoOrgIds } from "./types";
import {
  DEMO_EMAIL_DOMAIN,
  type DemoSeedOutcome,
  type DemoServiceCount,
} from "../constants";

const SERVICE = "reflect";
const LABEL = "Reflect 360";

const TEMPLATE_NAME = "VIFM Leadership Essentials";
const ENGAGEMENT_NAME = "Najm Capital - Senior Leaders 360";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

type Row = { id: string };

// A deterministic, realistic-looking score for a given rater group + behaviour.
// Others rate a touch higher than self on People/Communication and a touch
// lower on Strategy, so the self-vs-others gap reads like a real 360. Clamped
// to the 1-5 frequency scale.
function scoreFor(role: string, compIdx: number, behIdx: number): number {
  // base "others" perception per competency (display_order 1..5 -> idx 0..4)
  const othersBase = [3.6, 4.1, 4.3, 3.9, 3.7][compIdx % 5];
  const selfBase = [4.2, 4.0, 3.6, 3.5, 3.8][compIdx % 5]; // self over-rates strategy, under-rates people
  const base = role === "self" ? selfBase : othersBase;
  // small per-behaviour wobble so items aren't all identical
  const wobble = [(behIdx % 3) - 1, 1 - (behIdx % 2)][role === "manager" ? 1 : 0] * 0.4;
  const v = Math.round(base + wobble);
  return Math.min(5, Math.max(1, v));
}

async function seed(sb: DemoSb, org: DemoOrgIds): Promise<DemoSeedOutcome> {
  // Idempotency: skip if this org already has a demo Reflect engagement.
  const existing = await sb
    .from("reflect_engagements")
    .select("id")
    .eq("organization_id", org.araOrganizationId)
    .eq("name", ENGAGEMENT_NAME)
    .limit(1);
  if (existing.error) throw new Error(`Reflect engagement lookup: ${existing.error.message}`);
  if (existing.data && existing.data.length > 0) {
    return { service: SERVICE, label: LABEL, created: 0, note: "already present" };
  }

  // 1) Engagement (live so it shows as an active 360 on the dashboard).
  //    consultant_id stays null - the dashboard shows it to admins regardless,
  //    and we don't want to pin it to a real consultant's auth uid.
  const eng = await sb
    .from("reflect_engagements")
    .insert({
      organization_id: org.araOrganizationId,
      name: ENGAGEMENT_NAME,
      region: "saudi",
      sector: "banking",
      status: "live",
      default_language: "en",
      report_language: "bilingual",
      anonymity_min_n: 3,
      participant_target_count: 8,
      field_window_start: daysAgo(14).slice(0, 10),
      field_window_end: daysAgo(-7).slice(0, 10),
      launched_at: daysAgo(12),
    })
    .select("id")
    .single<Row>();
  if (eng.error || !eng.data) throw new Error(`Reflect engagement: ${eng.error?.message}`);
  const engId = eng.data.id;

  // 2) Framework: clone the seeded "VIFM Leadership Essentials" library
  //    template (the same path the wizard's "clone a template" branch uses).
  //    Falls back to a small built-in framework if the template seed
  //    (migration 00033) isn't present, so the demo still populates.
  const fw = await cloneTemplateFramework(sb, engId);

  // 3) Participants - two senior leaders.
  const partRes = await sb
    .from("reflect_participants")
    .insert([
      {
        engagement_id: engId,
        full_name: "Hessa Al Suwaidi",
        full_name_ar: "حصة السويدي",
        email: `hessa.suwaidi@${DEMO_EMAIL_DOMAIN}`,
        role_title: "Head of Corporate Banking",
        business_unit: "Corporate Banking",
        level_tier: "senior_mgr",
        manager_email: `cco@${DEMO_EMAIL_DOMAIN}`,
        language_preference: "en",
        status: "in_progress",
      },
      {
        engagement_id: engId,
        full_name: "Tariq Al Otaibi",
        full_name_ar: "طارق العتيبي",
        email: `tariq.otaibi@${DEMO_EMAIL_DOMAIN}`,
        role_title: "Head of Treasury",
        business_unit: "Treasury",
        level_tier: "senior_mgr",
        manager_email: `cco@${DEMO_EMAIL_DOMAIN}`,
        language_preference: "en",
        status: "in_progress",
      },
    ])
    .select("id");
  if (partRes.error || !partRes.data) throw new Error(`Reflect participants: ${partRes.error?.message}`);
  const participants = partRes.data as Row[];

  // 4) Raters per participant: self + manager + 3 peers (peers clear the
  //    default anonymity_min_n=3 so peer scores reveal in the report).
  type RaterSpec = { role: string; name: string; emailLocal: string };
  const raterSpecs: Record<number, RaterSpec[]> = {
    0: [
      { role: "self", name: "Hessa Al Suwaidi", emailLocal: "hessa.suwaidi" },
      { role: "manager", name: "Khalid Al Mutairi", emailLocal: "khalid.mutairi" },
      { role: "peer", name: "Reem Al Harthi", emailLocal: "reem.harthi" },
      { role: "peer", name: "Sami Al Ghamdi", emailLocal: "sami.ghamdi" },
      { role: "peer", name: "Maha Al Qahtani", emailLocal: "maha.qahtani" },
    ],
    1: [
      { role: "self", name: "Tariq Al Otaibi", emailLocal: "tariq.otaibi" },
      { role: "manager", name: "Khalid Al Mutairi", emailLocal: "khalid.mutairi" },
      { role: "peer", name: "Nora Al Shehri", emailLocal: "nora.shehri" },
      { role: "peer", name: "Faisal Al Dosari", emailLocal: "faisal.dosari" },
    ],
  };

  const raterRows: Array<Record<string, unknown>> = [];
  participants.forEach((p, pi) => {
    for (const r of raterSpecs[pi]) {
      raterRows.push({
        participant_id: p.id,
        rater_role: r.role,
        full_name: r.name,
        email: `${r.emailLocal}@${DEMO_EMAIL_DOMAIN}`,
        language_preference: "en",
        access_token: crypto.randomUUID(),
        // First participant's pool fully completed; second still in progress.
        status: pi === 0 ? "completed" : r.role === "self" ? "completed" : "started",
        invited_at: daysAgo(12),
        completed_at: pi === 0 ? daysAgo(2) : r.role === "self" ? daysAgo(3) : null,
      });
    }
  });
  const raterRes = await sb
    .from("reflect_raters")
    .insert(raterRows)
    .select("id, participant_id, rater_role");
  if (raterRes.error || !raterRes.data) throw new Error(`Reflect raters: ${raterRes.error?.message}`);
  const raters = raterRes.data as Array<{ id: string; participant_id: string; rater_role: string }>;

  // 5) Responses: one score per rater per behaviour. We score every rater of
  //    participant[0] (fully complete report) and only the self + manager of
  //    participant[1] (partially complete). compIdx/behIdx drive a deterministic
  //    self-vs-others gap so the report reads like a real instrument.
  const partIdxById = new Map(participants.map((p, i) => [p.id, i] as const));
  const responseRows: Array<Record<string, unknown>> = [];
  for (const r of raters) {
    const pi = partIdxById.get(r.participant_id) ?? 0;
    // partially answer participant[1]'s non-self raters (skip them -> in progress)
    if (pi === 1 && r.rater_role !== "self" && r.rater_role !== "manager") continue;
    fw.behaviors.forEach((b) => {
      responseRows.push({
        rater_id: r.id,
        behavior_id: b.id,
        score: scoreFor(r.rater_role, b.compIdx, b.behIdx),
        is_na: false,
        answered_at: daysAgo(pi === 0 ? 2 : 3),
      });
    });
  }
  if (responseRows.length > 0) {
    // Insert in chunks to stay well under any payload limits.
    for (let i = 0; i < responseRows.length; i += 200) {
      const chunk = responseRows.slice(i, i + 200);
      const rIns = await sb.from("reflect_responses").insert(chunk);
      if (rIns.error) throw new Error(`Reflect responses: ${rIns.error.message}`);
    }
  }

  return {
    service: SERVICE,
    label: LABEL,
    created: 1,
    note: `engagement + 2 participants, ${raters.length} raters, ${responseRows.length} responses (1 fully scored)`,
  };
}

// Clone the library template's competencies + behaviours into an
// engagement-bound framework. Returns the new competency/behaviour ids tagged
// with compIdx/behIdx for deterministic scoring. Falls back to a built-in
// 3-competency framework when the template seed isn't present.
async function cloneTemplateFramework(
  sb: DemoSb,
  engagementId: string
): Promise<{ behaviors: Array<{ id: string; compIdx: number; behIdx: number }> }> {
  const tpl = await sb
    .from("reflect_frameworks")
    .select("id, name_en, name_ar, description_en, description_ar")
    .eq("is_template", true)
    .eq("name_en", TEMPLATE_NAME)
    .maybeSingle<{
      id: string;
      name_en: string;
      name_ar: string | null;
      description_en: string | null;
      description_ar: string | null;
    }>();

  // Create the engagement framework row.
  const fwIns = await sb
    .from("reflect_frameworks")
    .insert({
      engagement_id: engagementId,
      name_en: tpl.data?.name_en ?? TEMPLATE_NAME,
      name_ar: tpl.data?.name_ar ?? "أساسيات القيادة من VIFM",
      description_en: tpl.data?.description_en ?? "Leadership 360 framework for the demo engagement.",
      description_ar: tpl.data?.description_ar ?? null,
      source: tpl.data ? "template" : "custom",
      is_template: false,
      is_active: true,
      approved_at: daysAgo(13),
    })
    .select("id")
    .single<Row>();
  if (fwIns.error || !fwIns.data) throw new Error(`Reflect framework: ${fwIns.error?.message}`);
  const newFwId = fwIns.data.id;

  // Source competencies + behaviours: from the template if present, else a
  // small built-in set so the demo never lands on an empty framework.
  type SrcComp = {
    name_en: string;
    name_ar: string | null;
    description_en: string | null;
    description_ar: string | null;
    display_order: number;
    behaviors: Array<{ text_en: string; text_ar: string | null; display_order: number }>;
  };
  let sourceComps: SrcComp[] = [];

  if (tpl.data) {
    const comps = await sb
      .from("reflect_competencies")
      .select("id, name_en, name_ar, description_en, description_ar, display_order")
      .eq("framework_id", tpl.data.id)
      .order("display_order");
    const compList = (comps.data ?? []) as Array<{
      id: string;
      name_en: string;
      name_ar: string | null;
      description_en: string | null;
      description_ar: string | null;
      display_order: number;
    }>;
    const compIds = compList.map((c) => c.id);
    const behs =
      compIds.length === 0
        ? { data: [] as Array<{ competency_id: string; text_en: string; text_ar: string | null; display_order: number }> }
        : await sb
            .from("reflect_behaviors")
            .select("competency_id, text_en, text_ar, display_order")
            .in("competency_id", compIds)
            .order("display_order");
    const behList = (behs.data ?? []) as Array<{
      competency_id: string;
      text_en: string;
      text_ar: string | null;
      display_order: number;
    }>;
    sourceComps = compList.map((c) => ({
      name_en: c.name_en,
      name_ar: c.name_ar,
      description_en: c.description_en,
      description_ar: c.description_ar,
      display_order: c.display_order,
      behaviors: behList
        .filter((b) => b.competency_id === c.id)
        .map((b) => ({ text_en: b.text_en, text_ar: b.text_ar, display_order: b.display_order })),
    }));
  }

  if (sourceComps.length === 0) {
    // Built-in fallback (3 competencies x 3 behaviours).
    sourceComps = [
      {
        name_en: "Drives Vision and Purpose", name_ar: "يقود الرؤية والغاية", description_en: "Connects today's actions to long-term outcomes.", description_ar: null, display_order: 1,
        behaviors: [
          { text_en: "Translates strategy into clear team objectives.", text_ar: null, display_order: 1 },
          { text_en: "Anticipates external trends and adjusts plans early.", text_ar: null, display_order: 2 },
          { text_en: "Connects the team's work to the wider strategy.", text_ar: null, display_order: 3 },
        ],
      },
      {
        name_en: "Drives Results", name_ar: "يقود النتائج", description_en: "Turns plans into measurable outcomes.", description_ar: null, display_order: 2,
        behaviors: [
          { text_en: "Sets clear, measurable goals with milestones.", text_ar: null, display_order: 1 },
          { text_en: "Holds others accountable and follows through.", text_ar: null, display_order: 2 },
          { text_en: "Removes blockers quickly.", text_ar: null, display_order: 3 },
        ],
      },
      {
        name_en: "Builds Effective Teams", name_ar: "يبني فرقاً فعّالة", description_en: "Develops and trusts the team to deliver.", description_ar: null, display_order: 3,
        behaviors: [
          { text_en: "Gives timely, specific, balanced feedback.", text_ar: null, display_order: 1 },
          { text_en: "Coaches team members to grow.", text_ar: null, display_order: 2 },
          { text_en: "Delegates meaningful work, not just tasks.", text_ar: null, display_order: 3 },
        ],
      },
    ];
  }

  // Insert cloned competencies + behaviours; collect behaviour ids with idx.
  const behaviors: Array<{ id: string; compIdx: number; behIdx: number }> = [];
  for (let ci = 0; ci < sourceComps.length; ci++) {
    const c = sourceComps[ci];
    const compIns = await sb
      .from("reflect_competencies")
      .insert({
        framework_id: newFwId,
        name_en: c.name_en,
        name_ar: c.name_ar,
        description_en: c.description_en,
        description_ar: c.description_ar,
        display_order: c.display_order,
      })
      .select("id")
      .single<Row>();
    if (compIns.error || !compIns.data) throw new Error(`Reflect competency: ${compIns.error?.message}`);
    const compId = compIns.data.id;

    if (c.behaviors.length > 0) {
      const behIns = await sb
        .from("reflect_behaviors")
        .insert(
          c.behaviors.map((b) => ({
            competency_id: compId,
            level_tier: "all" as const,
            text_en: b.text_en,
            text_ar: b.text_ar,
            source: "manual" as const,
            display_order: b.display_order,
          }))
        )
        .select("id");
      if (behIns.error || !behIns.data) throw new Error(`Reflect behaviors: ${behIns.error?.message}`);
      (behIns.data as Row[]).forEach((b, bi) => {
        behaviors.push({ id: b.id, compIdx: ci, behIdx: bi });
      });
    }
  }

  return { behaviors };
}

async function purge(sb: DemoSb, org: DemoOrgIds): Promise<string> {
  // FK-safe order: responses -> raters -> participants/idps/reports/email/frameworks
  // (competencies + behaviours cascade off frameworks; reports/idps cascade off
  // participants) -> engagements. Scoped to the demo ARA org's engagements.
  const engRes = await sb
    .from("reflect_engagements")
    .select("id")
    .eq("organization_id", org.araOrganizationId);
  const engIds = ((engRes.data ?? []) as Row[]).map((r) => r.id);
  if (engIds.length === 0) return "no reflect demo rows";

  // participants in these engagements
  const partRes = await sb.from("reflect_participants").select("id").in("engagement_id", engIds);
  const partIds = ((partRes.data ?? []) as Row[]).map((r) => r.id);

  if (partIds.length > 0) {
    const raterRes = await sb.from("reflect_raters").select("id").in("participant_id", partIds);
    const raterIds = ((raterRes.data ?? []) as Row[]).map((r) => r.id);
    if (raterIds.length > 0) {
      await sb.from("reflect_responses").delete().in("rater_id", raterIds);
      await sb.from("reflect_raters").delete().in("id", raterIds);
    }
    await sb.from("reflect_idps").delete().in("participant_id", partIds);
    await sb.from("reflect_reports").delete().in("participant_id", partIds);
    await sb.from("reflect_participants").delete().in("id", partIds);
  }

  // Engagement-level children. behaviours + competencies cascade off frameworks.
  await sb.from("reflect_reports").delete().in("engagement_id", engIds);
  await sb.from("reflect_email_log").delete().in("engagement_id", engIds);
  await sb.from("reflect_frameworks").delete().in("engagement_id", engIds);
  await sb.from("reflect_engagements").delete().in("id", engIds);

  return `reflect engagements removed (${engIds.length})`;
}

async function count(sb: DemoSb, org: DemoOrgIds): Promise<DemoServiceCount | null> {
  const res = await sb
    .from("reflect_engagements")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.araOrganizationId);
  // Missing table (un-applied migration) -> tolerate, return null.
  if (res.error) return null;
  return { service: SERVICE, label: LABEL, count: res.count ?? 0 };
}

const reflectModule: DemoServiceModule = { id: SERVICE, label: LABEL, seed, purge, count };

export default reflectModule;
