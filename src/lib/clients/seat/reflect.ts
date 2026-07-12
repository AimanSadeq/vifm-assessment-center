// Client-portal SEAT issuance for Reflect 360 (server-only). A client_manager
// runs a Reflect 360 self-serve from a VIFM-prepared shell, drawing seats from an
// admin-granted allocation. The shell is a per-org reflect_engagements row
// (consultant_id NULL, status 'draft') seeded from a library framework template.
//
// Auth + org are resolved by the CALLER and passed in - this module never reads
// the session. Every insert forces shell.organization_id = araOrgId so client
// input can never widen the org. Seats are drawn BEFORE people are created and
// released on any failure, so quota is never lost.
//
// Why raw inserts here instead of the reflect/actions.ts server actions: those
// gate on requireRole(["admin","consultant"]) / requireEngagementOwner, which do
// NOT admit client_manager. Per the recipe we gate + force org in THIS module and
// reuse the service's OWN derivation logic (template clone + self-rater creation)
// inline, rather than skipping it with naive inserts.

import { drawAllocation, releaseAllocation, type Allocation } from "../allocations";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages, chunkIds } from "@/lib/ara/paginate";
import { sendReflectEmail, roleLabel } from "@/lib/reflect/email";

export type SeatDelegate = { email: string; name?: string };
export type SeatActivityRow = {
  id: string;
  name: string;
  date: string;
  summary: string;
  reportPath: string;
};
export type SeatActivity = {
  shellId: string | null;
  invited: number;
  started: number;
  completed: number;
  rows: SeatActivityRow[];
};

const SERVICE = "reflect" as const;
const EMPTY: SeatActivity = { shellId: null, invited: 0, started: 0, completed: 0, rows: [] };

type Lang = "en" | "ar";
type RaterRole = "self" | "manager" | "peer" | "direct_report" | "skip_level" | "other";

type ServiceConfig = {
  shellName?: string;
  templateId?: string;
  region?: "uae" | "saudi";
  sector?: "government" | "banking" | "general";
  defaultLanguage?: Lang;
  reportLanguage?: "en" | "ar" | "bilingual";
  anonymityMinN?: number;
};

function cfgOf(alloc: Allocation): ServiceConfig {
  return (alloc.service_config ?? {}) as ServiceConfig;
}

function shellNameFor(cfg: ServiceConfig): string {
  const name = (cfg.shellName ?? "").trim();
  return name.length >= 2 ? name : "Reflect 360 - client self-serve";
}

// ──────────────────────────────────────────────────────────────
// Clone a library framework template into the shell engagement.
// Mirrors cloneTemplateInternal in src/lib/reflect/actions.ts so the
// competencies + behaviours are derived, not invented. Best-effort:
// a clone failure does not throw (the shell can still be edited).
// ──────────────────────────────────────────────────────────────
async function cloneTemplateIntoEngagement(
  sb: ReturnType<typeof createServiceClient>,
  engagementId: string,
  templateId: string | null
): Promise<void> {
  // Resolve the template: explicit id from service_config, else the first
  // library template (is_template = true).
  let tplId = templateId;
  if (!tplId) {
    const { data: firstTpl } = await sb
      .from("reflect_frameworks")
      .select("id")
      .eq("is_template", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();
    tplId = firstTpl?.id ?? null;
  }
  if (!tplId) return;

  const { data: tpl } = await sb
    .from("reflect_frameworks")
    .select("id, name_en, name_ar, description_en, description_ar, is_template")
    .eq("id", tplId)
    .maybeSingle<{
      id: string;
      name_en: string;
      name_ar: string | null;
      description_en: string | null;
      description_ar: string | null;
      is_template: boolean;
    }>();
  if (!tpl || !tpl.is_template) return;

  const { data: newFw } = await sb
    .from("reflect_frameworks")
    .insert({
      engagement_id: engagementId,
      name_en: tpl.name_en,
      name_ar: tpl.name_ar,
      description_en: tpl.description_en,
      description_ar: tpl.description_ar,
      source: "template",
      is_template: false,
      is_active: true,
    })
    .select("id")
    .single<{ id: string }>();
  if (!newFw) return;

  const { data: comps } = await sb
    .from("reflect_competencies")
    .select("id, name_en, name_ar, description_en, description_ar, display_order")
    .eq("framework_id", tpl.id)
    .order("display_order");

  for (const c of (comps ?? []) as Array<{
    id: string;
    name_en: string;
    name_ar: string | null;
    description_en: string | null;
    description_ar: string | null;
    display_order: number;
  }>) {
    const { data: newComp } = await sb
      .from("reflect_competencies")
      .insert({
        framework_id: newFw.id,
        name_en: c.name_en,
        name_ar: c.name_ar,
        description_en: c.description_en,
        description_ar: c.description_ar,
        display_order: c.display_order,
      })
      .select("id")
      .single<{ id: string }>();
    if (!newComp) continue;

    const { data: behs } = await sb
      .from("reflect_behaviors")
      .select("level_tier, text_en, text_ar, display_order")
      .eq("competency_id", c.id)
      .order("display_order");

    const rows = ((behs ?? []) as Array<{
      level_tier: string;
      text_en: string;
      text_ar: string | null;
      display_order: number;
    }>).map((b) => ({
      competency_id: newComp.id,
      level_tier: b.level_tier,
      text_en: b.text_en,
      text_ar: b.text_ar,
      source: "manual" as const,
      display_order: b.display_order,
    }));
    if (rows.length > 0) await sb.from("reflect_behaviors").insert(rows);
  }
}

// ──────────────────────────────────────────────────────────────
// find-or-create the per-org Reflect shell. Keyed on
// (organization_id, status='draft', consultant_id IS NULL, name) so a
// second self-serve from the same org reuses the same shell.
// ──────────────────────────────────────────────────────────────
export async function ensureReflectShell(
  orgId: string,
  araOrgId: string | null,
  alloc: Allocation
): Promise<{ shellId: string } | { error: string }> {
  if (!orgId) return { error: "Missing organisation" };
  // The shell engagement lives under ara_organizations.id. Without it we
  // cannot org-scope the engagement, so a self-serve cannot proceed.
  if (!araOrgId) {
    return { error: "This client is not linked to a Reflect organisation yet. Ask VIFM to finish setup." };
  }

  const cfg = cfgOf(alloc);
  const shellName = shellNameFor(cfg);

  try {
    const sb = createServiceClient();

    // Reuse an existing draft shell for this org if one is already prepared.
    const { data: existing } = await sb
      .from("reflect_engagements")
      .select("id")
      .eq("organization_id", araOrgId)
      .eq("status", "draft")
      .is("consultant_id", null)
      .eq("name", shellName)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (existing?.id) return { shellId: existing.id };

    const { data: created, error: insErr } = await sb
      .from("reflect_engagements")
      .insert({
        organization_id: araOrgId, // forced - never trust client input
        consultant_id: null,
        name: shellName,
        region: cfg.region ?? null,
        sector: cfg.sector ?? null,
        status: "draft",
        default_language: cfg.defaultLanguage ?? "en",
        report_language: cfg.reportLanguage ?? "bilingual",
        anonymity_min_n: cfg.anonymityMinN && cfg.anonymityMinN >= 1 ? cfg.anonymityMinN : 3,
        is_sandbox: false,
      })
      .select("id")
      .single<{ id: string }>();
    if (insErr || !created) {
      return { error: insErr?.message ?? "Could not create the Reflect shell" };
    }

    // Seed the framework from a library template so the 360 has items to rate.
    await cloneTemplateIntoEngagement(sb, created.id, cfg.templateId ?? null);

    return { shellId: created.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the Reflect shell" };
  }
}

// ──────────────────────────────────────────────────────────────
// Ensure each participant has a self-rater. Mirrors
// ensureSelfRatersForParticipants in reflect/actions.ts (a 360 always
// includes the participant rating themselves). Idempotent.
// ──────────────────────────────────────────────────────────────
async function ensureSelfRaters(
  sb: ReturnType<typeof createServiceClient>,
  participantIds: string[]
): Promise<void> {
  if (participantIds.length === 0) return;
  const { data: existing } = await sb
    .from("reflect_raters")
    .select("participant_id")
    .eq("rater_role", "self")
    .in("participant_id", participantIds);
  const haveSelf = new Set(((existing ?? []) as Array<{ participant_id: string }>).map((r) => r.participant_id));
  const missing = participantIds.filter((id) => !haveSelf.has(id));
  if (missing.length === 0) return;

  const { data: parts } = await sb
    .from("reflect_participants")
    .select("id, full_name, email, language_preference")
    .in("id", missing);
  const rows = ((parts ?? []) as Array<{
    id: string;
    full_name: string;
    email: string;
    language_preference: Lang;
  }>).map((p) => ({
    participant_id: p.id,
    rater_role: "self" as const,
    full_name: p.full_name,
    email: p.email,
    language_preference: p.language_preference,
  }));
  if (rows.length > 0) await sb.from("reflect_raters").insert(rows);
}

// ──────────────────────────────────────────────────────────────
// Send rater invitations for the shell (only raters with invited_at
// NULL). Mirrors sendInvitationsForEngagement in reflect/actions.ts.
// ──────────────────────────────────────────────────────────────
async function sendShellInvitations(
  sb: ReturnType<typeof createServiceClient>,
  engagementId: string
): Promise<number> {
  const { data: eng } = await sb
    .from("reflect_engagements")
    .select(
      "id, name, is_sandbox, anonymity_min_n, default_language, ara_organizations(name, name_ar)"
    )
    .eq("id", engagementId)
    .maybeSingle<{
      id: string;
      name: string;
      is_sandbox: boolean;
      anonymity_min_n: number;
      default_language: Lang;
      ara_organizations: { name: string; name_ar: string | null } | null;
    }>();
  if (!eng) return 0;

  type ShellRater = {
    id: string;
    rater_role: RaterRole;
    full_name: string;
    email: string;
    language_preference: Lang;
    access_token: string;
    invited_at: string | null;
    reflect_participants: { engagement_id: string; full_name: string; full_name_ar: string | null };
  };
  // Paginate (deterministic .order('id')): a large shell can have >1000 uninvited
  // raters, and an unpaginated read caps at 1000 in arbitrary order, so a single
  // self-serve "invite all" would silently email only the first ~1000 and leave
  // the rest uninvited with no error. The read runs BEFORE any emailing (which
  // stamps invited_at), so the page window is stable.
  let raters: ShellRater[];
  try {
    raters = await fetchAllPages<ShellRater>((from, to) =>
      sb
        .from("reflect_raters")
        .select(
          "id, rater_role, full_name, email, language_preference, access_token, invited_at, reflect_participants!inner(engagement_id, full_name, full_name_ar)"
        )
        .eq("reflect_participants.engagement_id", engagementId)
        .is("invited_at", null)
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: ShellRater[] | null; error: { message: string } | null }>,
    );
  } catch {
    return 0;
  }
  if (raters.length === 0) return 0;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  const now = new Date().toISOString();
  let emailed = 0;

  for (const r of raters) {
    const language: Lang = r.language_preference || eng.default_language || "en";
    const participantName =
      language === "ar"
        ? r.reflect_participants.full_name_ar ?? r.reflect_participants.full_name
        : r.reflect_participants.full_name;
    const orgName =
      language === "ar"
        ? eng.ara_organizations?.name_ar ?? eng.ara_organizations?.name ?? ""
        : eng.ara_organizations?.name ?? "";

    const res = await sendReflectEmail({
      to: r.email,
      emailType: "reflect_rater_invitation",
      language,
      isSandbox: eng.is_sandbox,
      engagementId: eng.id,
      raterId: r.id,
      data: {
        raterName: r.full_name,
        participantName,
        engagementName: eng.name,
        organizationName: orgName,
        anonymityN: String(eng.anonymity_min_n),
        roleLabel: roleLabel(r.rater_role, language),
        respondentUrl: `${baseUrl}/reflect/respond/${r.access_token}`,
      },
    });
    // Only a REAL send counts + stamps invited_at: a console-mock returns
    // ok:true/delivered:false, and stamping invited_at on a mock would wrongly
    // mark the rater "invited" and make the resend sweep skip them later.
    if (res.delivered) {
      emailed += 1;
      await sb.from("reflect_raters").update({ invited_at: now }).eq("id", r.id);
    }
  }
  return emailed;
}

// ──────────────────────────────────────────────────────────────
// invite: ensure shell, draw seats, create participants + self-raters
// bound to the shell, flip the shell live + send invitations. Seats are
// drawn BEFORE people are created and released on any failure.
//
// One seat = one Reflect participant (the leader being assessed). Each
// participant gets a self-rater here; additional raters (manager, peers,
// direct reports) are added later in the Reflect console.
// ──────────────────────────────────────────────────────────────
export async function inviteReflect(opts: {
  orgId: string;
  araOrgId: string | null;
  alloc: Allocation;
  delegates: SeatDelegate[];
}): Promise<{ ok: true; invited: number; emailed: number } | { error: string }> {
  const { orgId, araOrgId, alloc, delegates } = opts;

  const clean = (delegates ?? [])
    .map((d) => ({ email: (d.email ?? "").trim().toLowerCase(), name: d.name?.trim() || undefined }))
    .filter((d) => d.email.length > 0);
  if (clean.length === 0) return { error: "Add at least one participant" };

  // 1. Ensure the shell exists (org forced inside).
  const shell = await ensureReflectShell(orgId, araOrgId, alloc);
  if ("error" in shell) return { error: shell.error };
  const engagementId = shell.shellId;

  // 2. Reserve seats atomically (over-quota / expired -> refused).
  const draw = await drawAllocation(orgId, SERVICE, clean.length);
  if (!draw.ok) {
    return {
      error:
        draw.reason === "over_quota"
          ? "Not enough seats remaining (or the allocation has expired)."
          : draw.message || "Could not reserve seats.",
    };
  }

  // 3. Create the people + send invitations. A PRE-commit failure releases the
  // full draw; once participants are committed `created` tracks them so the
  // catch never claws back seats for rows that persisted.
  let created = 0;
  try {
    const sb = createServiceClient();
    const cfg = cfgOf(alloc);
    const lang: Lang = cfg.defaultLanguage ?? "en";

    const participantRows = clean.map((d) => ({
      engagement_id: engagementId, // forced via the org-owned shell
      full_name: d.name && d.name.length >= 2 ? d.name : d.email,
      email: d.email,
      level_tier: "manager" as const,
      language_preference: lang,
      status: "invited" as const,
    }));

    const { data: inserted, error: partErr } = await sb
      .from("reflect_participants")
      .insert(participantRows)
      .select("id");
    if (partErr) throw new Error(partErr.message);
    const newIds = ((inserted ?? []) as Array<{ id: string }>).map((p) => p.id);
    if (newIds.length === 0) throw new Error("No participants were created");
    created = newIds.length; // participants are now committed; their seats are consumed

    // Self-rater per participant (reuses the service's derivation rule).
    await ensureSelfRaters(sb, newIds);

    // The shell framework is a cloned, pre-reviewed library template (never
    // AI-decomposed), so it is approved by construction - stamp
    // framework_approved_at so it satisfies the reflect framework-approval gate
    // (migration 00182) without a consultant step. Best-effort + separate from the
    // flip so a fresh env without 00182 (missing column) still goes live.
    await sb
      .from("reflect_engagements")
      .update({ framework_approved_at: new Date().toISOString() })
      .eq("id", engagementId)
      .is("framework_approved_at", null);

    // Flip the shell live so raters can respond, then send invitations.
    await sb
      .from("reflect_engagements")
      .update({ status: "live", launched_at: new Date().toISOString() })
      .eq("id", engagementId)
      .eq("status", "draft");

    const emailed = await sendShellInvitations(sb, engagementId);

    // Audit lineage (best-effort).
    try {
      await sb.from("reflect_audit_log").insert({
        action: "engagement.client_self_serve_invite",
        target_table: "reflect_engagements",
        target_id: engagementId,
        metadata: { invited: newIds.length, source: "client_portal" },
      });
    } catch {
      /* best-effort */
    }

    return { ok: true, invited: newIds.length, emailed };
  } catch (e) {
    console.error("[reflect-seat] inviteReflect failed:", e instanceof Error ? e.message : e);
    // Release only the seats whose participant never committed. After the atomic
    // insert, created === clean.length, so this is 0 - committed participants keep
    // their (legitimately consumed) seats instead of being wrongly clawed back.
    await releaseAllocation(orgId, SERVICE, clean.length - created);
    return { error: e instanceof Error ? e.message : "Could not create Reflect participants" };
  }
}

// ──────────────────────────────────────────────────────────────
// Org-scoped monitor: invited / started / completed counts for the
// org's Reflect shell(s) + a row per completed participant with the
// PDF report path the portal links to.
// ──────────────────────────────────────────────────────────────
export async function reflectSeatActivity(
  orgId: string,
  araOrgId: string | null
): Promise<SeatActivity> {
  if (!orgId || !araOrgId) return EMPTY;
  try {
    const sb = createServiceClient();

    // All Reflect engagements for this org (shells + any consultant-run ones).
    const { data: engs } = await sb
      .from("reflect_engagements")
      .select("id, created_at")
      .eq("organization_id", araOrgId)
      .order("created_at", { ascending: true });
    const engRows = (engs ?? []) as Array<{ id: string; created_at: string }>;
    if (engRows.length === 0) return { ...EMPTY, shellId: null };

    const engIds = engRows.map((e) => e.id);
    const shellId = engRows[0]?.id ?? null;

    // Participants in scope (the assessed leaders = the seats consumed). Page the
    // set (deterministic .order('id')): an unpaginated read caps at 1000, so a
    // large cohort would truncate partIds and undercount the whole seat funnel.
    type PartRow = { id: string; full_name: string; status: string; created_at: string; updated_at: string };
    const partRows = await fetchAllPages<PartRow>((from, to) =>
      sb
        .from("reflect_participants")
        .select("id, full_name, status, created_at, updated_at")
        .in("engagement_id", engIds)
        .order("id")
        .range(from, to),
    ).catch(() => [] as PartRow[]);
    const partIds = partRows.map((p) => p.id);

    // Rater funnel: invited (invited_at set) / started (first_opened_at set = the
    // rater opened the form). CHUNK the participant-id .in(): a >1000-id IN list is
    // itself a problem, and each rater maps to exactly one participant so summing
    // per-chunk head counts is exact (no double-count).
    let invited = 0;
    let started = 0;
    for (const chunk of chunkIds(partIds)) {
      const { count: invCount } = await sb
        .from("reflect_raters")
        .select("id", { count: "exact", head: true })
        .in("participant_id", chunk)
        .not("invited_at", "is", null);
      invited += invCount ?? 0;

      const { count: openCount } = await sb
        .from("reflect_raters")
        .select("id", { count: "exact", head: true })
        .in("participant_id", chunk)
        .not("first_opened_at", "is", null);
      started += openCount ?? 0;
    }

    // Completed participants: a report released / closed. Count over the FULL
    // paged set (invited/started are already exact, so completed must be too - a
    // 100-sliced count would show a wrong, internally inconsistent funnel); slice
    // only the display rows.
    const completedParts = partRows
      .filter((p) => p.status === "report_released" || p.status === "closed")
      .sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at));
    const completedParticipants = completedParts.length;
    const completedRows: SeatActivityRow[] = completedParts.slice(0, 100).map((p) => ({
      id: p.id,
      name: p.full_name?.trim() || "Participant",
      date: p.updated_at || p.created_at,
      summary: p.status === "report_released" ? "Report released" : "Feedback closed",
      reportPath: `/api/reflect/reports/${p.id}/pdf`,
    }));

    // A cohort report row for the primary shell, so the portal can link the
    // engagement-level view alongside the per-participant reports.
    if (shellId) {
      completedRows.unshift({
        id: shellId,
        name: "Cohort report",
        date: engRows[0].created_at,
        summary: "Engagement-wide 360 summary",
        reportPath: `/api/reflect/reports/cohort/${shellId}/pdf`,
      });
    }

    return {
      shellId,
      invited,
      started,
      completed: completedParticipants,
      rows: completedRows,
    };
  } catch {
    return EMPTY;
  }
}