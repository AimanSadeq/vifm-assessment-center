"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createClientOrganization } from "@/lib/clients/registry";
import { sendEmail, isEmailConfigured } from "@/lib/integrations/email";
import { logPrehireEvent } from "@/lib/prehire/audit";
import { rescoreCandidate } from "@/lib/prehire/candidate-access";
import { buildPrehireCandidatePdf } from "@/lib/reports/prehire-candidate-pdf";
import { uuidish } from "@/lib/validations/ids";
import { DEMO_ORG_NAME, DEMO_ORG_NAME_AR } from "@/lib/demo/constants";
import type { PrehireStagePlanEntry, PrehireStageKind } from "@/types/prehire";

/** Flatten a Zod error into a readable message (field errors included, not just
 *  top-level formErrors - otherwise a field failure shows the useless fallback). */
function zodMessage(error: z.ZodError, fallback: string): string {
  const fl = error.flatten();
  const fields = Object.entries(fl.fieldErrors)
    .filter((e): e is [string, string[]] => Array.isArray(e[1]) && e[1].length > 0)
    .map(([k, v]) => `${k}: ${v.join(", ")}`);
  return [...fl.formErrors, ...fields].filter(Boolean).join("; ") || fallback;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Admin-only gate. Under AUTH_ENABLED=false the guard returns a synthetic admin
// (dev keeps working); under auth=on it refuses non-admin callers. Writes go
// through the service client so RLS doesn't block the legitimate admin path.
async function gateAdmin(): Promise<{ error: string } | null> {
  try {
    await requireRole(["admin"]);
    return null;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}

// ── SME review + certification (Pre-Hire #3) ──────────────────────
// A VIFM assessor reviews the candidate's AI-scored responses and certifies the
// screening result. Stamps certified_at/by + notes (migration 00145). Best-
// effort on the audit log; tolerant of the migration not being applied (the
// update simply errors and we surface it).
const certifySchema = z.object({
  requisitionId: uuidish,
  candidateId: uuidish,
  reviewerName: z.string().trim().min(1, "Reviewer name is required").max(120),
  notes: z.string().trim().max(4000).optional(),
});

export async function certifyPrehireCandidateAction(input: {
  requisitionId: string;
  candidateId: string;
  reviewerName: string;
  notes?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await gateAdmin();
  if (gate) return { ok: false, error: gate.error };
  const parsed = certifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: zodMessage(parsed.error, "Invalid certification") };
  // ids from the typed input (uuidish validates but its output widens to unknown);
  // text fields from the parsed/trimmed result.
  const { requisitionId, candidateId } = input;
  const { reviewerName, notes } = parsed.data;

  const sb = createServiceClient();
  const { error } = await sb
    .from("prehire_candidates")
    .update({
      certified_at: new Date().toISOString(),
      certified_by: reviewerName,
      certification_notes: notes?.trim() || null,
    })
    .eq("id", candidateId)
    .eq("requisition_id", requisitionId);
  if (error) {
    return {
      ok: false,
      error: /column .* does not exist/i.test(error.message)
        ? "Certification needs migration 00145 applied."
        : error.message,
    };
  }

  await logPrehireEvent({
    action: "candidate_certified",
    requisitionId,
    candidateId,
    actorLabel: "admin",
    detail: { reviewer: reviewerName },
  });
  revalidatePath(`/admin/prehire/${requisitionId}`);
  revalidatePath(`/admin/prehire/${requisitionId}/candidate/${candidateId}/review`);
  return { ok: true };
}

const stageEntrySchema = z
  .object({
    kind: z.enum(["fluent", "quiz", "cbi", "assessment_center"]),
    weight: z.coerce.number().min(0).max(1),
    cut_score: z.coerce.number().min(0).max(100).nullable(),
    required: z.boolean(),
    // Fluent stage only (CAL-PRE-503): which CEFR sub-skills to administer.
    // Omitted/empty = all four (back-compat). Persisted in stage_config jsonb.
    skills: z.array(z.enum(["reading", "listening", "writing", "speaking"])).optional(),
  })
  // Server-side enforce the receptive-skill rule (the wizard guards it too, but a
  // crafted request must not persist an indefensible writing/speaking-only Fluent
  // stage). Omitted/empty skills = all four, so they pass.
  .refine(
    (s) =>
      s.kind !== "fluent" ||
      !s.skills ||
      s.skills.length === 0 ||
      s.skills.some((k) => k === "reading" || k === "listening"),
    { message: "The Fluent stage needs at least one receptive skill (Reading or Listening)." },
  );

// NOTE: organization_id / role_profile_id / competency_ids use uuidish (a
// permissive UUID-shape check), NOT z.string().uuid(). The seed competencies +
// role profiles carry synthetic UUIDs (version nibble 0) that Zod 4's strict
// .uuid() rejects - which silently failed every requisition that involved a
// role profile or quiz competencies ("Invalid requisition"). See lib/validations/ids.
const requisitionSchema = z.object({
  organization_id: uuidish("Select a client organization"),
  title: z.string().min(2, "Title is required").max(160),
  role_profile_id: uuidish().nullable().optional(),
  level: z.string().max(60).optional(),
  english_required: z.boolean().optional(),
  stage_config: z.array(stageEntrySchema).min(1, "Pick at least one screening stage"),
  // CAL-PRE-502: explicit competency set for the quiz stage (competencies.id[]).
  // Pre-filled from the role profile but editable. Optional/empty = legacy fallback.
  competency_ids: z.array(uuidish()).optional(),
});

export async function createRequisitionAction(input: unknown) {
  const gate = await gateAdmin();
  if (gate) return gate;

  const parsed = requisitionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: zodMessage(parsed.error, "Invalid requisition") };
  }

  const svc = createServiceClient();
  // Drop empties + de-dupe; an empty set is the same as "not set" (legacy fallback).
  const competencyIds = Array.from(
    new Set((parsed.data.competency_ids ?? []).filter((id) => typeof id === "string" && id))
  );

  const insertPayload: Record<string, unknown> = {
    organization_id: parsed.data.organization_id,
    title: parsed.data.title,
    role_profile_id: parsed.data.role_profile_id ?? null,
    level: parsed.data.level || null,
    english_required: parsed.data.english_required ?? false,
    stage_config: parsed.data.stage_config,
    status: "open",
    ...(competencyIds.length > 0 ? { competency_ids: competencyIds } : {}),
  };

  let { data, error } = await svc
    .from("prehire_requisitions")
    .insert(insertPayload)
    .select("id")
    .single();

  // Tolerant: a pre-00138 DB rejects competency_ids with 42703 (undefined_column)
  // or PGRST204 (PostgREST schema-cache miss). Strip it and retry so the
  // requisition still creates (the quiz just falls back to role-profile/synthetic).
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "42703" || code === "PGRST204") {
      const { competency_ids: _omit, ...core } = insertPayload;
      void _omit;
      ({ data, error } = await svc
        .from("prehire_requisitions")
        .insert(core)
        .select("id")
        .single());
    }
  }

  if (error || !data) return { error: error?.message ?? "Could not create requisition" };

  await logPrehireEvent({
    action: "requisition_created",
    requisitionId: data.id as string,
    actorLabel: "admin",
    detail: { title: parsed.data.title, stages: parsed.data.stage_config.map((s) => s.kind) },
  });

  revalidatePath("/admin/prehire");
  return { data: { id: data.id as string } };
}

// Edit the stage plan of an existing requisition (add/remove Competency Quiz /
// Fluent / AI Interview, adjust weights, cut-scores, Fluent sub-skills). Reuses
// the same stageEntrySchema + receptive-skill rule as create. On save we
// re-score every candidate from the new plan: a removed stage drops out of the
// composite, an added stage makes it incomplete until taken.
const updateStagesSchema = z.object({
  requisition_id: uuidish("Invalid requisition"),
  stage_config: z.array(stageEntrySchema).min(1, "Pick at least one screening stage"),
});

export async function updateRequisitionStagesAction(input: unknown) {
  const gate = await gateAdmin();
  if (gate) return gate;

  const parsed = updateStagesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: zodMessage(parsed.error, "Invalid stage plan") };
  }

  const svc = createServiceClient();
  // english_required follows the Fluent stage, exactly as on create.
  const englishRequired = parsed.data.stage_config.some((s) => s.kind === "fluent");

  const { error } = await svc
    .from("prehire_requisitions")
    .update({ stage_config: parsed.data.stage_config, english_required: englishRequired })
    .eq("id", parsed.data.requisition_id);
  if (error) return { error: error.message };

  // Re-score every candidate from the new plan (best-effort, per candidate).
  const { data: cands } = await svc
    .from("prehire_candidates")
    .select("id")
    .eq("requisition_id", parsed.data.requisition_id);
  for (const c of (cands ?? []) as { id: string }[]) {
    await rescoreCandidate(c.id);
  }

  await logPrehireEvent({
    action: "requisition_updated",
    requisitionId: parsed.data.requisition_id,
    actorLabel: "admin",
    detail: { stages: parsed.data.stage_config.map((s) => s.kind) },
  });

  revalidatePath(`/admin/prehire/${parsed.data.requisition_id}`);
  return { ok: true as const };
}

/**
 * Inline client creation from the requisition wizard (CAL-PH-504). Dual-writes
 * to both org stores via the shared registry so the new client is selectable in
 * every service, then returns it for immediate selection. Deduped by name.
 */
export async function createPrehireOrgAction(input: { name: string; industry?: string; country?: string }) {
  const gate = await gateAdmin();
  if (gate) return gate;
  const name = (input?.name ?? "").trim();
  if (name.length < 2) return { error: "Enter a client name." };
  const res = await createClientOrganization({
    name,
    industry: input?.industry?.trim() || null,
    country: input?.country?.trim() || null,
  });
  if (!res.ok) return { error: res.error };
  revalidatePath("/admin/prehire/new");
  return { data: { id: res.organizationId, name } };
}

const candidateSchema = z.object({
  requisition_id: uuidish(),
  full_name: z.string().min(2, "Name is required").max(160),
  email: z.string().email("Valid email required"),
  phone: z.string().max(40).optional(),
  // Recruiter metadata (00061). Optional internal identifier carried on the
  // candidate (re-hire / internal-mobility). Stored in custom_fields jsonb.
  employee_id: z.string().max(120).optional(),
});

export async function addCandidateAction(input: unknown) {
  const gate = await gateAdmin();
  if (gate) return gate;

  const parsed = candidateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: zodMessage(parsed.error, "Invalid candidate") };
  }

  const svc = createServiceClient();
  // Add the candidate WITHOUT inviting - the admin decides when to send the
  // invite (they often add many candidates first). invited_at stays null = not
  // yet invited; the per-row "Send invite" / copy-link affordances do the send.
  const employeeId = (parsed.data.employee_id ?? "").trim();
  const { data, error } = await svc
    .from("prehire_candidates")
    .insert({
      requisition_id: parsed.data.requisition_id,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      status: "invited", // pipeline entry state (enum has no "added"); invited_at null = uninvited
      invited_at: null,
    })
    .select("id, access_token")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not add candidate" };

  // Best-effort: stash the recruiter's custom fields. Separate UPDATE (not part
  // of the insert) so a pre-00061 DB without the column still adds the candidate.
  // Supabase surfaces a missing-column as a resolved { error }, not a throw, so
  // ignoring the result is enough - the candidate is already added either way.
  if (employeeId) {
    await svc
      .from("prehire_candidates")
      .update({ custom_fields: { employee_id: employeeId } })
      .eq("id", data.id);
  }

  await logPrehireEvent({
    action: "candidate_added",
    requisitionId: parsed.data.requisition_id,
    candidateId: data.id as string,
    actorLabel: "admin",
  });

  revalidatePath(`/admin/prehire/${parsed.data.requisition_id}`);
  return { data: { id: data.id as string, access_token: data.access_token as string, emailed: false } };
}

// ── Self-serve demo screening ────────────────────────────────────
// Start the candidate experience with one click - no requisition wizard, no
// invite link/voucher (the same front-and-centre entry the other instruments
// have). Reuses the shared demo org + a find-or-create "Demo Screening"
// requisition, then mints a fresh anonymous candidate and returns its token so
// the caller drops straight into the real apply flow. Everything lands under the
// demo org, so the Demo-data purge removes it.
const DEMO_REQ_TITLE = "Demo Screening (self-serve)";
const DEMO_STAGE_PLAN: PrehireStagePlanEntry[] = [
  { kind: "quiz", weight: 0.4, cut_score: 60, required: true },
  { kind: "fluent", weight: 0.3, cut_score: 50, required: true },
  { kind: "cbi", weight: 0.3, cut_score: 60, required: false },
];

export async function startPrehireDemoAction(): Promise<{ data: { token: string } } | { error: string }> {
  const gate = await gateAdmin();
  if (gate) return gate;
  try {
    const org = await createClientOrganization({
      name: DEMO_ORG_NAME,
      nameAr: DEMO_ORG_NAME_AR,
      industry: "Banking",
      country: "Saudi Arabia",
    });
    if (!org.ok) return { error: org.error };
    const svc = createServiceClient();

    let reqId: string;
    const existing = await svc
      .from("prehire_requisitions")
      .select("id")
      .eq("organization_id", org.organizationId)
      .eq("title", DEMO_REQ_TITLE)
      .limit(1)
      .maybeSingle();
    if (existing.data?.id) {
      reqId = existing.data.id as string;
    } else {
      const ins = await svc
        .from("prehire_requisitions")
        .insert({
          organization_id: org.organizationId,
          title: DEMO_REQ_TITLE,
          level: "Manager",
          english_required: true,
          stage_config: DEMO_STAGE_PLAN,
          status: "open",
        })
        .select("id")
        .single();
      if (ins.error || !ins.data) return { error: ins.error?.message ?? "Could not create the demo requisition" };
      reqId = ins.data.id as string;
    }

    const stamp = Date.now().toString(36);
    const cand = await svc
      .from("prehire_candidates")
      .insert({
        requisition_id: reqId,
        full_name: "Demo Candidate",
        email: `demo-${stamp}@caliber-demo.local`,
        status: "invited",
        invited_at: null,
      })
      .select("access_token")
      .single();
    if (cand.error || !cand.data?.access_token) return { error: cand.error?.message ?? "Could not start the demo" };

    return { data: { token: cand.data.access_token as string } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not start the demo screening" };
  }
}

/** Invite every not-yet-invited candidate on a requisition (admin "send all"). */
export async function inviteAllPendingAction(requisitionId: string) {
  const gate = await gateAdmin();
  if (gate) return gate;
  if (typeof requisitionId !== "string" || !requisitionId) return { error: "Missing requisition" };

  try {
    const svc = createServiceClient();
    const { data: pending } = await svc
      .from("prehire_candidates")
      .select("id")
      .eq("requisition_id", requisitionId)
      .is("invited_at", null);
    let sent = 0;
    for (const c of (pending ?? []) as { id: string }[]) {
      if (await sendPrehireInvite(c.id)) sent += 1;
    }
    revalidatePath(`/admin/prehire/${requisitionId}`);
    return { data: { total: (pending ?? []).length, sent } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send invites" };
  }
}

/** Resend the invitation email to an existing candidate (admin-gated). */
export async function resendPrehireInviteAction(candidateId: string) {
  const gate = await gateAdmin();
  if (gate) return gate;
  if (typeof candidateId !== "string" || !candidateId) return { error: "Missing candidate" };

  const emailed = await sendPrehireInvite(candidateId);
  return emailed
    ? { data: { emailed: true } }
    : isEmailConfigured()
    ? { error: "Couldn't send the invitation email. Please try again." }
    : { data: { emailed: false } }; // not configured - UI falls back to the copy link
}

// ── Invitation email helper ──────────────────────────────────────
// Loads the candidate + requisition + org, builds the token apply URL, sends
// the bilingual-free invitation, and stamps invited_at. Returns true only when
// Graph is configured AND the send succeeded (so the UI can distinguish a real
// send from the console-mock fallback). Best-effort: never throws.
const STAGE_MINUTES: Record<PrehireStageKind, number> = {
  quiz: 5,
  fluent: 15,
  cbi: 10,
  assessment_center: 0, // run elsewhere, not part of the self-served apply flow
};

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://caliber.viftraining.com"
  ).replace(/\/+$/, "");
}

async function sendPrehireInvite(candidateId: string): Promise<boolean> {
  try {
    const svc = createServiceClient();
    const { data: cand } = await svc
      .from("prehire_candidates")
      .select("id, full_name, email, access_token, requisition_id")
      .eq("id", candidateId)
      .maybeSingle();
    if (!cand?.email || !cand.access_token) return false;

    const { data: req } = await svc
      .from("prehire_requisitions")
      .select("title, stage_config, organizations(name)")
      .eq("id", cand.requisition_id)
      .maybeSingle();
    if (!req) return false;

    const orgName = (req.organizations as unknown as { name: string } | null)?.name ?? null;
    const plan = (req.stage_config ?? []) as PrehireStagePlanEntry[];
    const minutes = plan.reduce((sum, s) => sum + (STAGE_MINUTES[s.kind] ?? 0), 0);
    const duration = minutes > 0 ? `${minutes} minutes` : "a few minutes";

    const applyUrl = `${appBaseUrl()}/prehire/apply/${cand.access_token}`;

    const ok = await sendEmail({
      to: cand.email as string,
      template: "prehire_invitation",
      data: {
        candidateName: (cand.full_name as string)?.split(" ")[0] || "there",
        roleTitle: (req.title as string) ?? "the role",
        orgName: orgName ?? "the hiring organization",
        orgClause: orgName ? ` with ${orgName}` : "",
        duration,
        applyUrl,
      },
    });

    await svc
      .from("prehire_candidates")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", cand.id);

    const emailed = isEmailConfigured() && ok;
    await logPrehireEvent({
      action: "invitation_sent",
      requisitionId: cand.requisition_id as string,
      candidateId: cand.id as string,
      actorLabel: "admin",
      detail: { channel: emailed ? "email" : "link", emailConfigured: isEmailConfigured() },
    });
    return emailed;
  } catch (e) {
    console.error("[prehire] invite email failed:", e);
    return false;
  }
}

/** Set the client contact who receives this requisition's screening reports. */
export async function setRequisitionClientEmailAction(requisitionId: string, email: string) {
  const gate = await gateAdmin();
  if (gate) return gate;
  if (typeof requisitionId !== "string" || !requisitionId) return { error: "Missing requisition" };

  const trimmed = (email ?? "").trim();
  if (trimmed && !EMAIL_RE.test(trimmed)) return { error: "Enter a valid email address" };

  const svc = createServiceClient();
  const { error } = await svc
    .from("prehire_requisitions")
    .update({ client_recipient_email: trimmed || null })
    .eq("id", requisitionId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/prehire/${requisitionId}`);
  return { data: { email: trimmed || null } };
}

// ── Deliver the report to the client ─────────────────────────────
// VIFM screens as a service: the client gets the per-candidate report and makes
// the hiring decision. This builds the same PDF as the admin download route and
// emails it (as an attachment) to the requisition's client recipient, then
// records report_sent_at/report_sent_to + an audit event.
type Lang = "en" | "ar";

async function deliverReport(
  candidateId: string,
  lang: Lang,
  actor: { uid: string; isDev: boolean }
): Promise<{ ok: true; to: string; emailed: boolean } | { ok: false; error: string }> {
  const svc = createServiceClient();
  const { data: cand } = await svc
    .from("prehire_candidates")
    .select("id, full_name, requisition_id, custom_fields")
    .eq("id", candidateId)
    .maybeSingle();
  if (!cand) return { ok: false, error: "Candidate not found" };

  const { data: req } = await svc
    .from("prehire_requisitions")
    .select("title, client_recipient_email, organizations(name)")
    .eq("id", cand.requisition_id as string)
    .maybeSingle();
  const recipient = (req?.client_recipient_email as string | null)?.trim();
  if (!recipient) return { ok: false, error: "Set a client recipient email first." };

  const pdf = await buildPrehireCandidatePdf({
    requisitionId: cand.requisition_id as string,
    candidateId,
    lang,
  });
  if (!pdf.ok) return { ok: false, error: pdf.error };

  const empId = (cand.custom_fields as Record<string, string> | null)?.employee_id?.trim();
  const orgName = (req?.organizations as unknown as { name: string } | null)?.name ?? null;

  const ok = await sendEmail({
    to: recipient,
    template: "prehire_client_report",
    data: {
      clientName: orgName ? `${orgName} team` : "Hiring team",
      candidateName: (cand.full_name as string) ?? "the candidate",
      roleTitle: (req?.title as string) ?? "the role",
      empClause: empId ? ` (Employee ID: ${empId})` : "",
    },
    attachments: [
      { filename: pdf.filename, contentBase64: pdf.pdf.toString("base64"), contentType: "application/pdf" },
    ],
  });
  if (!ok && isEmailConfigured()) return { ok: false, error: "Couldn't send the email. Please try again." };

  // A "send" only counts when email is actually configured. With no Graph creds
  // sendEmail console-mocks and returns true - so DON'T mark the report delivered
  // or the UI would falsely claim it was sent (this bit us in testing).
  const emailed = isEmailConfigured() && ok;
  if (emailed) {
    await svc
      .from("prehire_candidates")
      .update({ report_sent_at: new Date().toISOString(), report_sent_to: recipient })
      .eq("id", candidateId);
  }

  await logPrehireEvent({
    action: "report_shared",
    requisitionId: cand.requisition_id as string,
    candidateId,
    actorId: actor.isDev ? null : actor.uid,
    actorLabel: "admin",
    detail: { channel: emailed ? "email" : "mock" }, // never log the recipient address
  });

  return { ok: true, to: recipient, emailed };
}

/** Email one candidate's screening report to the requisition's client contact. */
export async function sendReportToClientAction(input: { candidateId: string; lang?: Lang }) {
  let caller;
  try {
    caller = await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
  const { candidateId } = input ?? {};
  if (typeof candidateId !== "string" || !candidateId) return { error: "Missing candidate" };
  const lang: Lang = input.lang === "ar" ? "ar" : "en";

  const res = await deliverReport(candidateId, lang, { uid: caller.uid, isDev: caller.isDev });
  if (!res.ok) return { error: res.error };

  const { data: cand } = await createServiceClient()
    .from("prehire_candidates")
    .select("requisition_id")
    .eq("id", candidateId)
    .maybeSingle();
  if (cand?.requisition_id) revalidatePath(`/admin/prehire/${cand.requisition_id}`);
  return { data: { to: res.to, emailed: res.emailed } };
}

/** Email every scored candidate's report to the client contact (batch send). */
export async function sendAllReportsToClientAction(requisitionId: string, lang?: Lang) {
  let caller;
  try {
    caller = await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
  if (typeof requisitionId !== "string" || !requisitionId) return { error: "Missing requisition" };
  const useLang: Lang = lang === "ar" ? "ar" : "en";

  const svc = createServiceClient();
  // Only candidates who have at least one completed stage are worth sending.
  const { data: rows } = await svc
    .from("prehire_candidates")
    .select("id, prehire_stage_results(status)")
    .eq("requisition_id", requisitionId);
  const sendable = ((rows ?? []) as { id: string; prehire_stage_results: { status: string }[] }[]).filter((r) =>
    (r.prehire_stage_results ?? []).some((s) => s.status === "completed")
  );

  let sent = 0; // counts only real (emailed) sends, not dev mocks
  let lastError: string | null = null;
  for (const r of sendable) {
    const res = await deliverReport(r.id, useLang, { uid: caller.uid, isDev: caller.isDev });
    if (res.ok) {
      if (res.emailed) sent += 1;
    } else {
      lastError = res.error;
    }
  }

  revalidatePath(`/admin/prehire/${requisitionId}`);
  if (sent === 0 && lastError) return { error: lastError };
  return { data: { sent, total: sendable.length, configured: isEmailConfigured() } };
}
