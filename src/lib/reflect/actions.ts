"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  requireRole,
  isAuthorizationError,
  AuthorizationError,
} from "@/lib/ara/auth-guards";
import {
  createEngagementSchema,
  upsertCompetencySchema,
  upsertBehaviorSchema,
  bulkParticipantsSchema,
  bulkRatersSchema,
  launchEngagementSchema,
  type CreateEngagementPayload,
  type UpsertCompetencyPayload,
  type UpsertBehaviorPayload,
} from "./validations";
import { extractBehaviorsFromValues } from "@/lib/ai/reflect-behavior-extractor";
import { sendReflectEmail, roleLabel } from "./email";

// ──────────────────────────────────────────────────────────────
// Inline org creation - used by the wizard's "Add new" affordance.
// Inserts into ara_organizations (Reflect reuses the AR Compass
// client list) and returns the newly created row so the wizard can
// merge it into the picker without a refetch.
// ──────────────────────────────────────────────────────────────

const createInlineOrgSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(160),
  name_ar: z.string().trim().max(160).optional().or(z.literal("")),
  region: z.enum(["uae", "saudi"]),
  sector: z.enum(["government", "banking", "general"]),
});

export type CreateInlineOrgPayload = z.infer<typeof createInlineOrgSchema>;

export async function createInlineReflectOrganisation(
  payload: CreateInlineOrgPayload
): Promise<
  | { ok: true; org: { id: string; name: string; name_ar: string | null; region: "uae" | "saudi"; sector: "government" | "banking" | "general" } }
  | { ok: false; error: string }
> {
  let caller;
  try {
    caller = await requireRole(["admin", "consultant"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false, error: e.message };
    throw e;
  }

  const parsed = createInlineOrgSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const p = parsed.data;

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("ara_organizations")
    .insert({
      name: p.name,
      name_ar: p.name_ar ? p.name_ar : null,
      sector: p.sector,
      region: p.region,
      created_by: caller.isDev ? null : caller.uid,
    })
    .select("id, name, name_ar, region, sector")
    .single<{
      id: string;
      name: string;
      name_ar: string | null;
      region: "uae" | "saudi";
      sector: "government" | "banking" | "general";
    }>();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };

  return { ok: true, org: data };
}


function authErr(e: unknown) {
  if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
  throw e;
}

// ──────────────────────────────────────────────────────────────
// Owner check (mirrors ARA's requireAssessmentOwner). Admins
// always pass; consultants must own the engagement.
// ──────────────────────────────────────────────────────────────

async function requireEngagementOwner(engagementId: string) {
  const caller = await requireRole(["admin", "consultant"]);
  if (caller.role === "admin") return caller;

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("reflect_engagements")
    .select("consultant_id")
    .eq("id", engagementId)
    .maybeSingle<{ consultant_id: string | null }>();
  if (error || !data) throw new AuthorizationError("Engagement not found");
  if (data.consultant_id !== caller.uid) {
    throw new AuthorizationError("Not the engagement owner");
  }
  return caller;
}

/** Resolve a framework to its engagement_id and check ownership. */
async function requireEngagementOwnerByFramework(frameworkId: string) {
  const sb = createServiceClient();
  const { data } = await sb
    .from("reflect_frameworks")
    .select("engagement_id")
    .eq("id", frameworkId)
    .maybeSingle<{ engagement_id: string | null }>();
  if (!data?.engagement_id) throw new AuthorizationError("Framework not found");
  return requireEngagementOwner(data.engagement_id);
}

/** Resolve a competency to its engagement_id and check ownership. */
async function requireOwnerForCompetency(competencyId: string) {
  const sb = createServiceClient();
  const { data } = await sb
    .from("reflect_competencies")
    .select("reflect_frameworks!inner(engagement_id)")
    .eq("id", competencyId)
    .maybeSingle<{ reflect_frameworks: { engagement_id: string } }>();
  if (!data?.reflect_frameworks?.engagement_id) {
    throw new AuthorizationError("Competency not found");
  }
  return requireEngagementOwner(data.reflect_frameworks.engagement_id);
}

/** Resolve a behavior to its engagement_id and check ownership. */
async function requireOwnerForBehavior(behaviorId: string) {
  const sb = createServiceClient();
  const { data } = await sb
    .from("reflect_behaviors")
    .select("reflect_competencies!inner(reflect_frameworks!inner(engagement_id))")
    .eq("id", behaviorId)
    .maybeSingle<{
      reflect_competencies: { reflect_frameworks: { engagement_id: string } };
    }>();
  const engagementId = data?.reflect_competencies?.reflect_frameworks?.engagement_id;
  if (!engagementId) throw new AuthorizationError("Behavior not found");
  return requireEngagementOwner(engagementId);
}


// ──────────────────────────────────────────────────────────────
// Create engagement
//
// Atomic-ish flow:
//   1) Validate payload
//   2) Insert reflect_engagement row (status=draft)
//   3) Create framework based on the chosen `framework.kind`:
//      - 'clone'   -> copy a template framework's competencies+behaviours
//      - 'manual'  -> create empty framework
//      - 'ai'      -> create framework + run Claude extraction and seed rows
//   4) Return the new engagement id; caller redirects to the wizard
//      framework step.
// ──────────────────────────────────────────────────────────────

export async function createReflectEngagement(
  payload: CreateEngagementPayload
): Promise<{ ok: true; engagementId: string } | { ok: false; error: string }> {
  let caller;
  try {
    caller = await requireRole(["admin", "consultant"]);
  } catch (e) {
    return authErr(e);
  }

  const parsed = createEngagementSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const p = parsed.data;

  const sb = createServiceClient();

  const { data: engagement, error: engErr } = await sb
    .from("reflect_engagements")
    .insert({
      name: p.name,
      organization_id: p.organization_id ?? null,
      consultant_id: caller.isDev ? null : caller.uid,
      region: p.region ?? null,
      sector: p.sector ?? null,
      default_language: p.default_language,
      report_language: p.report_language,
      anonymity_min_n: p.anonymity_min_n,
      participant_target_count: p.participant_target_count ?? null,
      field_window_start: p.field_window_start ?? null,
      field_window_end: p.field_window_end ?? null,
      is_sandbox: p.is_sandbox,
      status: "draft",
    })
    .select("id")
    .single<{ id: string }>();
  if (engErr || !engagement) {
    return { ok: false, error: engErr?.message ?? "Could not create engagement" };
  }
  const engagementId = engagement.id;

  // Framework branch
  if (p.framework.kind === "clone") {
    const cloneResult = await cloneTemplateInternal(sb, p.framework.templateId, engagementId, caller.isDev ? null : caller.uid);
    if (!cloneResult.ok) {
      // Rollback the engagement row so the wizard doesn't land on a broken state
      await sb.from("reflect_engagements").delete().eq("id", engagementId);
      return { ok: false, error: cloneResult.error };
    }
  } else if (p.framework.kind === "manual") {
    const { error: fwErr } = await sb.from("reflect_frameworks").insert({
      engagement_id: engagementId,
      name_en: p.framework.name_en,
      name_ar: p.framework.name_ar ?? null,
      source: "custom",
      is_template: false,
      created_by: caller.isDev ? null : caller.uid,
    });
    if (fwErr) {
      await sb.from("reflect_engagements").delete().eq("id", engagementId);
      return { ok: false, error: fwErr.message };
    }
  } else if (p.framework.kind === "ai") {
    // Create empty framework first
    const { data: fwRow, error: fwErr } = await sb
      .from("reflect_frameworks")
      .insert({
        engagement_id: engagementId,
        name_en: p.framework.name_en,
        name_ar: p.framework.name_ar ?? null,
        source: "custom",
        is_template: false,
        created_by: caller.isDev ? null : caller.uid,
      })
      .select("id")
      .single<{ id: string }>();
    if (fwErr || !fwRow) {
      await sb.from("reflect_engagements").delete().eq("id", engagementId);
      return { ok: false, error: fwErr?.message ?? "Could not create framework" };
    }

    // Run Claude - best-effort. If the AI call fails or returns
    // nothing, we leave the framework empty so the consultant can
    // populate it manually rather than blocking the wizard.
    const proposals = await extractBehaviorsFromValues({
      sourceText: p.framework.sourceText,
      defaultLanguage: p.default_language,
    });

    if (proposals && proposals.length > 0) {
      for (let i = 0; i < proposals.length; i++) {
        const item = proposals[i];
        const { data: comp, error: compErr } = await sb
          .from("reflect_competencies")
          .insert({
            framework_id: fwRow.id,
            name_en: item.competency_name_en,
            name_ar: item.competency_name_ar,
            description_en: item.description_en,
            description_ar: item.description_ar,
            display_order: i,
          })
          .select("id")
          .single<{ id: string }>();
        if (compErr || !comp) continue;

        const behaviorRows = item.behaviors.map((b, j) => ({
          competency_id: comp.id,
          level_tier: "all" as const,
          text_en: b.text_en,
          text_ar: b.text_ar,
          source: "ai_proposed" as const,
          ai_rationale: b.rationale,
          display_order: j,
        }));
        if (behaviorRows.length > 0) {
          await sb.from("reflect_behaviors").insert(behaviorRows);
        }
      }
    }
  }

  revalidatePath("/reflect/consultant");
  return { ok: true, engagementId };
}


// ──────────────────────────────────────────────────────────────
// Clone a library template into an engagement
// Internal helper, also exposed as a standalone action if needed.
// ──────────────────────────────────────────────────────────────

async function cloneTemplateInternal(
  sb: ReturnType<typeof createServiceClient>,
  templateId: string,
  engagementId: string,
  callerUid: string | null
): Promise<{ ok: true; frameworkId: string } | { ok: false; error: string }> {
  // Read the template + its children
  const { data: tpl, error: tplErr } = await sb
    .from("reflect_frameworks")
    .select("id, name_en, name_ar, description_en, description_ar, is_template")
    .eq("id", templateId)
    .maybeSingle<{
      id: string;
      name_en: string;
      name_ar: string | null;
      description_en: string | null;
      description_ar: string | null;
      is_template: boolean;
    }>();
  if (tplErr || !tpl) return { ok: false, error: "Template not found" };
  if (!tpl.is_template) return { ok: false, error: "Source framework is not a library template" };

  // Create the cloned framework
  const { data: newFw, error: fwErr } = await sb
    .from("reflect_frameworks")
    .insert({
      engagement_id: engagementId,
      name_en: tpl.name_en,
      name_ar: tpl.name_ar,
      description_en: tpl.description_en,
      description_ar: tpl.description_ar,
      source: "template",
      is_template: false,
      created_by: callerUid,
    })
    .select("id")
    .single<{ id: string }>();
  if (fwErr || !newFw) return { ok: false, error: fwErr?.message ?? "Could not clone framework" };

  // Copy competencies + behaviours
  const { data: comps } = await sb
    .from("reflect_competencies")
    .select("id, name_en, name_ar, description_en, description_ar, display_order")
    .eq("framework_id", tpl.id)
    .order("display_order");

  if (comps && comps.length > 0) {
    for (const c of comps as Array<{
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

      if (behs && behs.length > 0) {
        const rows = (behs as Array<{
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
        await sb.from("reflect_behaviors").insert(rows);
      }
    }
  }

  return { ok: true, frameworkId: newFw.id };
}


// ──────────────────────────────────────────────────────────────
// Competency + behaviour upsert (manual editor)
// ──────────────────────────────────────────────────────────────

export async function upsertReflectCompetency(payload: UpsertCompetencyPayload) {
  const parsed = upsertCompetencySchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const p = parsed.data;

  // P3-audit fix: gate updates on competency ownership (was previously
  // only a role check, which let a consultant overwrite another
  // consultant's competencies by guessing the id).
  try {
    if (p.id) await requireOwnerForCompetency(p.id);
    else await requireEngagementOwnerByFramework(p.framework_id);
  } catch (e) { return authErr(e); }

  const sb = createServiceClient();
  if (p.id) {
    const { error } = await sb
      .from("reflect_competencies")
      .update({
        name_en: p.name_en,
        name_ar: p.name_ar ?? null,
        description_en: p.description_en ?? null,
        description_ar: p.description_ar ?? null,
        display_order: p.display_order,
      })
      .eq("id", p.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: p.id };
  }
  const { data, error } = await sb
    .from("reflect_competencies")
    .insert({
      framework_id: p.framework_id,
      name_en: p.name_en,
      name_ar: p.name_ar ?? null,
      description_en: p.description_en ?? null,
      description_ar: p.description_ar ?? null,
      display_order: p.display_order,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  return { ok: true, id: data.id };
}


export async function upsertReflectBehavior(payload: UpsertBehaviorPayload) {
  const parsed = upsertBehaviorSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const p = parsed.data;

  // P3-audit fix: gate on behavior ownership (was previously only a
  // role check).
  try {
    if (p.id) await requireOwnerForBehavior(p.id);
    else await requireOwnerForCompetency(p.competency_id);
  } catch (e) { return authErr(e); }

  const sb = createServiceClient();
  if (p.id) {
    const { error } = await sb
      .from("reflect_behaviors")
      .update({
        level_tier: p.level_tier,
        text_en: p.text_en,
        text_ar: p.text_ar ?? null,
        display_order: p.display_order,
      })
      .eq("id", p.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: p.id };
  }
  const { data, error } = await sb
    .from("reflect_behaviors")
    .insert({
      competency_id: p.competency_id,
      level_tier: p.level_tier,
      text_en: p.text_en,
      text_ar: p.text_ar ?? null,
      source: "manual",
      display_order: p.display_order,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  return { ok: true, id: data.id };
}


export async function deleteReflectCompetency(competencyId: string) {
  // P3-audit fix: scope delete to the calling consultant's engagements.
  try { await requireOwnerForCompetency(competencyId); } catch (e) { return authErr(e); }
  const sb = createServiceClient();
  const { error } = await sb.from("reflect_competencies").delete().eq("id", competencyId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}


export async function deleteReflectBehavior(behaviorId: string) {
  // P3-audit fix: scope delete to the calling consultant's engagements.
  try { await requireOwnerForBehavior(behaviorId); } catch (e) { return authErr(e); }
  const sb = createServiceClient();
  const { error } = await sb.from("reflect_behaviors").delete().eq("id", behaviorId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}


// ──────────────────────────────────────────────────────────────
// Bulk import: participants
// ──────────────────────────────────────────────────────────────

export async function bulkUpsertReflectParticipants(input: {
  engagement_id: string;
  rows: unknown[];
}) {
  try { await requireEngagementOwner(input.engagement_id); } catch (e) { return authErr(e); }

  const parsed = bulkParticipantsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rows" };
  }

  const sb = createServiceClient();
  // Naive insert. If we wanted upsert-on-email we'd add a unique
  // (engagement_id, email) constraint first - not in M2 scope. For now,
  // if the email already exists in this engagement we let the second
  // insert succeed too; cleanup of duplicates is a consultant chore.
  const rows = parsed.data.rows.map((r) => ({
    engagement_id: parsed.data.engagement_id,
    full_name: r.full_name,
    email: r.email.toLowerCase(),
    role_title: r.role_title ?? null,
    business_unit: r.business_unit ?? null,
    level_tier: r.level_tier,
    manager_email: r.manager_email ? r.manager_email.toLowerCase() : null,
    language_preference: r.language_preference,
  }));
  const { error, count } = await sb
    .from("reflect_participants")
    .insert(rows, { count: "exact" });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/reflect/consultant/engagements/${parsed.data.engagement_id}`);
  return { ok: true, inserted: count ?? rows.length };
}


// ──────────────────────────────────────────────────────────────
// Bulk import: raters
// Raters reference a participant by participant_email. We resolve
// emails -> participant_id inside this engagement before inserting.
// ──────────────────────────────────────────────────────────────

export async function bulkUpsertReflectRaters(input: {
  engagement_id: string;
  rows: unknown[];
}) {
  try { await requireEngagementOwner(input.engagement_id); } catch (e) { return authErr(e); }

  const parsed = bulkRatersSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rows" };
  }

  const sb = createServiceClient();

  const { data: participants, error: fetchErr } = await sb
    .from("reflect_participants")
    .select("id, email")
    .eq("engagement_id", parsed.data.engagement_id);
  if (fetchErr) return { ok: false, error: fetchErr.message };

  const byEmail = new Map<string, string>();
  for (const p of (participants ?? []) as Array<{ id: string; email: string }>) {
    byEmail.set(p.email.toLowerCase(), p.id);
  }

  const resolved: Array<{
    participant_id: string;
    rater_role: string;
    full_name: string;
    email: string;
    language_preference: string;
  }> = [];
  const unmatched: string[] = [];
  for (const r of parsed.data.rows) {
    const pid = byEmail.get(r.participant_email.toLowerCase());
    if (!pid) {
      unmatched.push(r.participant_email);
      continue;
    }
    resolved.push({
      participant_id: pid,
      rater_role: r.rater_role,
      full_name: r.full_name,
      email: r.email.toLowerCase(),
      language_preference: r.language_preference,
    });
  }

  if (resolved.length === 0) {
    const sample = unmatched.slice(0, 5).join(", ");
    const hint =
      participants && participants.length === 0
        ? " Tip: import participants first - raters reference participants by email."
        : ` Tip: each rater's participant_email must exactly match an imported participant. Unmatched: ${sample}`;
    return { ok: false, error: `No raters matched a known participant.${hint}` };
  }

  const { error, count } = await sb
    .from("reflect_raters")
    .insert(resolved, { count: "exact" });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/reflect/consultant/engagements/${parsed.data.engagement_id}`);
  return {
    ok: true,
    inserted: count ?? resolved.length,
    unmatched_count: unmatched.length,
    unmatched_emails: unmatched.slice(0, 10),
  };
}


// ──────────────────────────────────────────────────────────────
// Launch engagement: flip status draft -> live, then send rater
// invitation emails (best-effort - failures don't roll back the
// status flip).
// ──────────────────────────────────────────────────────────────

export async function launchReflectEngagement(engagementId: string) {
  let caller;
  try { caller = await requireEngagementOwner(engagementId); } catch (e) { return authErr(e); }

  const parsed = launchEngagementSchema.safeParse({
    engagement_id: engagementId,
    confirm: true,
  });
  if (!parsed.success) return { ok: false, error: "Invalid launch payload" };

  const sb = createServiceClient();

  const { data: eng } = await sb
    .from("reflect_engagements")
    .select("status")
    .eq("id", engagementId)
    .maybeSingle<{ status: string }>();
  if (!eng) return { ok: false, error: "Engagement not found" };
  if (eng.status !== "draft") {
    return { ok: false, error: `Engagement is already '${eng.status}' - cannot relaunch` };
  }

  const { error: updErr } = await sb
    .from("reflect_engagements")
    .update({ status: "live", launched_at: new Date().toISOString() })
    .eq("id", engagementId);
  if (updErr) return { ok: false, error: updErr.message };

  // Audit trail
  await sb.from("reflect_audit_log").insert({
    action: "engagement.launched",
    target_table: "reflect_engagements",
    target_id: engagementId,
    performed_by: caller.isDev ? null : caller.uid,
    metadata: { note: "Status flipped to live; invitation emails dispatched." },
  });

  // Best-effort: send invitation emails to all pending raters. Failures
  // are logged but never roll back the launch.
  const sent = await sendInvitationsForEngagement(engagementId);

  revalidatePath(`/reflect/consultant/engagements/${engagementId}`);
  revalidatePath(`/reflect/consultant`);
  return { ok: true, invited: sent.count, failed: sent.failed };
}


// ──────────────────────────────────────────────────────────────
// Send pending-rater invitations for an engagement. Idempotent
// in spirit - only raters with invited_at IS NULL get emailed.
// Also exposed as a standalone resend action.
// ──────────────────────────────────────────────────────────────

export async function sendInvitationsForEngagement(
  engagementId: string,
  options: { onlyUninvited?: boolean } = { onlyUninvited: true }
): Promise<{ count: number; failed: number }> {
  const sb = createServiceClient();

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
      default_language: "en" | "ar";
      ara_organizations: { name: string; name_ar: string | null } | null;
    }>();
  if (!eng) return { count: 0, failed: 0 };

  let q = sb
    .from("reflect_raters")
    .select(
      "id, rater_role, full_name, email, language_preference, access_token, invited_at, reflect_participants!inner(engagement_id, full_name, full_name_ar)"
    )
    .eq("reflect_participants.engagement_id", engagementId);
  if (options.onlyUninvited !== false) q = q.is("invited_at", null);

  const { data: raters } = await q.returns<
    Array<{
      id: string;
      rater_role: "self" | "manager" | "peer" | "direct_report" | "skip_level" | "other";
      full_name: string;
      email: string;
      language_preference: "en" | "ar";
      access_token: string;
      invited_at: string | null;
      reflect_participants: {
        engagement_id: string;
        full_name: string;
        full_name_ar: string | null;
      };
    }>
  >();

  if (!raters || raters.length === 0) return { count: 0, failed: 0 };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  let count = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const r of raters) {
    const language = r.language_preference || eng.default_language || "en";
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
      participantId: undefined, // not denormalised; participant_id resolved via rater_id in log
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
    if (res.ok) {
      count += 1;
      await sb
        .from("reflect_raters")
        .update({ invited_at: now })
        .eq("id", r.id);
    } else {
      failed += 1;
    }
  }

  return { count, failed };
}


// Standalone server action: resend invitations on demand for any
// rater missing invited_at (e.g. added after the original launch).
export async function resendReflectInvitationsAction(engagementId: string) {
  try { await requireEngagementOwner(engagementId); } catch (e) { return authErr(e); }
  const result = await sendInvitationsForEngagement(engagementId, { onlyUninvited: true });
  revalidatePath(`/reflect/consultant/engagements/${engagementId}`);
  return { ok: true, ...result };
}


// ──────────────────────────────────────────────────────────────
// Read the framework + competencies + behaviours for an engagement.
// Powers the review-before-launch panel and the framework-PDF
// download in Step 5 of the wizard.
// ──────────────────────────────────────────────────────────────

export type ReflectFrameworkBundle = {
  framework: {
    id: string;
    name_en: string;
    name_ar: string | null;
    source: "custom" | "template";
  };
  competencies: Array<{
    id: string;
    name_en: string;
    name_ar: string | null;
    description_en: string | null;
    description_ar: string | null;
    display_order: number;
    behaviors: Array<{
      id: string;
      text_en: string;
      text_ar: string | null;
      source: "manual" | "ai_proposed" | "ai_accepted";
      ai_rationale: string | null;
      display_order: number;
    }>;
  }>;
};

export async function loadReflectFrameworkForEngagement(
  engagementId: string
): Promise<ReflectFrameworkBundle | null> {
  const sb = createServiceClient();

  const { data: framework } = await sb
    .from("reflect_frameworks")
    .select("id, name_en, name_ar, source")
    .eq("engagement_id", engagementId)
    .maybeSingle<{
      id: string;
      name_en: string;
      name_ar: string | null;
      source: "custom" | "template";
    }>();
  if (!framework) return null;

  const { data: comps } = await sb
    .from("reflect_competencies")
    .select("id, name_en, name_ar, description_en, description_ar, display_order")
    .eq("framework_id", framework.id)
    .order("display_order");

  const compIds = (comps ?? []).map((c) => c.id);
  const { data: behs } =
    compIds.length === 0
      ? { data: [] as Array<{ id: string; competency_id: string; text_en: string; text_ar: string | null; source: "manual" | "ai_proposed" | "ai_accepted"; ai_rationale: string | null; display_order: number }> }
      : await sb
          .from("reflect_behaviors")
          .select("id, competency_id, text_en, text_ar, source, ai_rationale, display_order")
          .in("competency_id", compIds)
          .order("display_order");

  return {
    framework,
    competencies: (comps ?? []).map((c) => ({
      id: c.id,
      name_en: c.name_en,
      name_ar: c.name_ar,
      description_en: c.description_en,
      description_ar: c.description_ar,
      display_order: c.display_order,
      behaviors: ((behs ?? []) as Array<{
        id: string;
        competency_id: string;
        text_en: string;
        text_ar: string | null;
        source: "manual" | "ai_proposed" | "ai_accepted";
        ai_rationale: string | null;
        display_order: number;
      }>)
        .filter((b) => b.competency_id === c.id)
        .map((b) => ({
          id: b.id,
          text_en: b.text_en,
          text_ar: b.text_ar,
          source: b.source,
          ai_rationale: b.ai_rationale,
          display_order: b.display_order,
        })),
    })),
  };
}


// ────────────────────────────────────────────────────────────────────
// Reassessment workflow - clones the design + (optionally) the
// participant list into a fresh draft engagement.
//
// Mirrors the ARA / AC pattern (00020 in the AC schema). What's copied:
//   - Engagement metadata (name suffixed with "(reassessment YYYY)")
//   - Framework - competencies + behaviours
//   - Participants - if carryParticipants=true. Each new participant
//     row stores its prior_participant_id so the report can render
//     "↑ +0.4 vs prior" deltas after the new run scores.
//
// What's NOT copied:
//   - Raters (each participant invites fresh raters)
//   - Responses, IDPs, reports - these are participant-level artefacts
//     for the prior run only.
// ────────────────────────────────────────────────────────────────────

export type CreateReassessmentResult =
  | { ok: true; newEngagementId: string }
  | { ok: false; error: string };

export async function createReflectReassessmentFromPrior(input: {
  priorEngagementId: string;
  carryParticipants?: boolean;
}): Promise<CreateReassessmentResult> {
  // P3-audit fix: must own the prior engagement before we can clone it
  // (or be admin). Previously this had NO auth check at all, letting
  // any authenticated user enumerate + exfiltrate another consultant's
  // engagement design.
  try {
    await requireEngagementOwner(input.priorEngagementId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not the prior engagement owner" };
  }

  const sb = createServiceClient();
  const carry = input.carryParticipants ?? true;

  // 1. Validate the prior engagement exists and is in a state where a
  //    reassessment makes sense (completed / archived).
  const { data: prior } = await sb
    .from("reflect_engagements")
    .select("*")
    .eq("id", input.priorEngagementId)
    .maybeSingle();
  if (!prior) return { ok: false, error: "Prior engagement not found" };
  if (!["completed", "live", "archived"].includes(prior.status)) {
    return {
      ok: false,
      error: `Engagement status "${prior.status}" can't be reassessed yet - wait until it's at least live.`,
    };
  }

  // 2. Create the new draft engagement, suffixing the name with the year.
  const year = new Date().getFullYear();
  const baseName = (prior.name as string).replace(/\s*\(reassessment\s+\d{4}\)\s*$/i, "");
  const newName = `${baseName} (reassessment ${year})`;

  const { data: newEng, error: newEngErr } = await sb
    .from("reflect_engagements")
    .insert({
      organization_id: prior.organization_id,
      consultant_id: prior.consultant_id,
      name: newName,
      region: prior.region,
      sector: prior.sector,
      status: "draft",
      default_language: prior.default_language,
      report_language: prior.report_language,
      scale_type: prior.scale_type,
      anonymity_min_n: prior.anonymity_min_n,
      participant_target_count: prior.participant_target_count,
      is_sandbox: prior.is_sandbox,
      prior_engagement_id: prior.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (newEngErr || !newEng) {
    return { ok: false, error: newEngErr?.message ?? "Could not create reassessment engagement" };
  }

  // 3. Clone the framework (competencies + behaviours). Look up the
  //    prior engagement's framework, copy each row, keep a map of
  //    old-comp-id → new-comp-id so we can rewrite the behaviour links.
  const { data: priorFw } = await sb
    .from("reflect_frameworks")
    .select("id, name_en, name_ar, description_en, description_ar, source")
    .eq("engagement_id", prior.id)
    .maybeSingle<{
      id: string;
      name_en: string;
      name_ar: string | null;
      description_en: string | null;
      description_ar: string | null;
      source: "custom" | "template";
    }>();
  if (priorFw) {
    const { data: newFw, error: newFwErr } = await sb
      .from("reflect_frameworks")
      .insert({
        engagement_id: newEng.id,
        name_en: priorFw.name_en,
        name_ar: priorFw.name_ar,
        description_en: priorFw.description_en,
        description_ar: priorFw.description_ar,
        source: priorFw.source,
        is_template: false,
        is_active: true,
      })
      .select("id")
      .single<{ id: string }>();
    if (newFwErr || !newFw) {
      return { ok: false, error: newFwErr?.message ?? "Could not clone framework" };
    }

    const { data: priorComps } = await sb
      .from("reflect_competencies")
      .select("id, name_en, name_ar, description_en, description_ar, display_order")
      .eq("framework_id", priorFw.id)
      .order("display_order");

    const compIdMap = new Map<string, string>();
    for (const c of priorComps ?? []) {
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
      if (newComp) compIdMap.set(c.id, newComp.id);
    }

    const priorCompIds = Array.from(compIdMap.keys());
    if (priorCompIds.length > 0) {
      const { data: priorBehs } = await sb
        .from("reflect_behaviors")
        .select("competency_id, level_tier, text_en, text_ar, source, ai_rationale, display_order")
        .in("competency_id", priorCompIds);
      if (priorBehs && priorBehs.length > 0) {
        const behaviorRows = priorBehs
          .map((b) => {
            const newCompId = compIdMap.get(b.competency_id);
            if (!newCompId) return null;
            return {
              competency_id: newCompId,
              level_tier: b.level_tier,
              text_en: b.text_en,
              text_ar: b.text_ar,
              source: b.source,
              ai_rationale: b.ai_rationale,
              display_order: b.display_order,
            };
          })
          .filter((b): b is NonNullable<typeof b> => b !== null);
        if (behaviorRows.length > 0) {
          await sb.from("reflect_behaviors").insert(behaviorRows);
        }
      }
    }
  }

  // 4. Optionally carry the participants over.
  if (carry) {
    const { data: priorParticipants } = await sb
      .from("reflect_participants")
      .select(
        "id, full_name, full_name_ar, email, role_title, business_unit, level_tier, manager_email, language_preference"
      )
      .eq("engagement_id", prior.id);
    if (priorParticipants && priorParticipants.length > 0) {
      const rows = priorParticipants.map((p) => ({
        engagement_id: newEng.id,
        full_name: p.full_name,
        full_name_ar: p.full_name_ar,
        email: p.email,
        role_title: p.role_title,
        business_unit: p.business_unit,
        level_tier: p.level_tier,
        manager_email: p.manager_email,
        language_preference: p.language_preference,
        status: "invited" as const,
        prior_participant_id: p.id,
      }));
      await sb.from("reflect_participants").insert(rows);
    }
  }

  // 5. Audit row so the consultant dashboard shows the lineage.
  await sb.from("reflect_audit_log").insert({
    action: "engagement.reassessment_created",
    target_table: "reflect_engagements",
    target_id: newEng.id,
    metadata: {
      prior_engagement_id: prior.id,
      carry_participants: carry,
    },
  });

  return { ok: true, newEngagementId: newEng.id };
}
