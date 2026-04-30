"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import type { VifmCourseQuoteRequestStatus } from "@/types/database";

function authErr(e: unknown) {
  if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
  throw e;
}

/**
 * Public-facing schema for the quote-request form. Anonymous submission
 * is allowed (the public /courses/[code]/request-quote page hits this
 * action) so server-side validation has to be tight.
 */
const submitQuoteRequestSchema = z.object({
  course_id: z.string().uuid("Invalid course id"),
  requester_name: z.string().trim().min(2, "Name is required").max(120),
  requester_email: z.string().trim().email("Valid email is required").max(200),
  requester_company: z.string().trim().min(2, "Company is required").max(160),
  requester_phone: z.string().trim().max(40).optional().or(z.literal("")),
  requester_role: z.string().trim().max(160).optional().or(z.literal("")),
  estimated_group_size: z.coerce.number().int().min(1).max(1000).optional().or(z.literal("")),
  preferred_start_date: z.string().trim().optional().or(z.literal("")),
  preferred_language: z.enum(["en", "ar", "bilingual"]).optional().or(z.literal("")),
  delivery_mode: z.enum(["in_person", "virtual", "hybrid"]).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

const empty = (v: unknown) => v === "" || v === null || v === undefined;
const orNull = <T>(v: T | "" | null | undefined): T | null =>
  empty(v) ? null : (v as T);

export async function submitCourseQuoteRequest(formData: FormData) {
  const parsed = submitQuoteRequestSchema.safeParse({
    course_id: formData.get("course_id"),
    requester_name: formData.get("requester_name"),
    requester_email: formData.get("requester_email"),
    requester_company: formData.get("requester_company"),
    requester_phone: formData.get("requester_phone") ?? "",
    requester_role: formData.get("requester_role") ?? "",
    estimated_group_size: formData.get("estimated_group_size") ?? "",
    preferred_start_date: formData.get("preferred_start_date") ?? "",
    preferred_language: formData.get("preferred_language") ?? "",
    delivery_mode: formData.get("delivery_mode") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;

  // Snapshot the course code + title so the admin queue keeps the
  // narrative even if the course is later removed from the catalogue.
  const sb = createServiceClient();
  const { data: course } = await sb
    .from("vifm_courses")
    .select("id, code, title_en")
    .eq("id", v.course_id)
    .maybeSingle<{ id: string; code: string | null; title_en: string }>();
  if (!course) {
    return { ok: false as const, error: "Course not found." };
  }

  // Anti-abuse forensics — IP + UA from request headers. We don't show
  // these in the admin UI by default; treat as PII.
  const h = headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = h.get("user-agent") ?? null;

  const { data: inserted, error } = await sb
    .from("vifm_course_quote_requests")
    .insert({
      course_id: course.id,
      course_code_snapshot: course.code,
      course_title_snapshot: course.title_en,
      requester_name: v.requester_name,
      requester_email: v.requester_email,
      requester_company: v.requester_company,
      requester_phone: orNull(v.requester_phone),
      requester_role: orNull(v.requester_role),
      estimated_group_size: empty(v.estimated_group_size) ? null : Number(v.estimated_group_size),
      preferred_start_date: orNull(v.preferred_start_date),
      preferred_language: orNull(v.preferred_language),
      delivery_mode: orNull(v.delivery_mode),
      notes: orNull(v.notes),
      status: "new" as VifmCourseQuoteRequestStatus,
      ip_address: ip,
      user_agent: ua,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !inserted) {
    console.error("[quote-request] insert failed:", error);
    return { ok: false as const, error: error?.message ?? "Save failed" };
  }

  // Optional email notification to VIFM sales — wired through the
  // existing AC email integration when configured. Falls back to a
  // console-mock when Microsoft Graph creds are absent, so dev still works.
  await maybeNotifySales({
    requestId: inserted.id,
    requesterName: v.requester_name,
    requesterEmail: v.requester_email,
    requesterCompany: v.requester_company,
    courseTitle: course.title_en,
    courseCode: course.code,
    groupSize: empty(v.estimated_group_size) ? null : Number(v.estimated_group_size),
    preferredStart: orNull(v.preferred_start_date),
    deliveryMode: orNull(v.delivery_mode),
    preferredLanguage: orNull(v.preferred_language),
    notes: empty(v.notes) ? null : (v.notes as string),
  }).catch((e) => console.warn("[quote-request] notification failed:", e));

  revalidatePath("/admin/courses/quotes");
  return { ok: true as const, id: inserted.id };
}

/**
 * Admin: update a quote request's status / assignment / internal notes.
 * Status transitions update the corresponding timestamp columns so the
 * admin can see when the lead moved through the pipeline.
 */
const updateQuoteSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "contacted", "quoted", "won", "lost"]).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  internal_notes: z.string().max(4000).nullable().optional(),
});

export async function updateCourseQuoteRequest(values: z.infer<typeof updateQuoteSchema>) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  const parsed = updateQuoteSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = createServiceClient();
  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
    if (parsed.data.status === "contacted") updates.contacted_at = new Date().toISOString();
    if (parsed.data.status === "quoted")    updates.quoted_at    = new Date().toISOString();
    if (parsed.data.status === "won" || parsed.data.status === "lost") {
      updates.closed_at = new Date().toISOString();
    }
  }
  if (parsed.data.assigned_to !== undefined) updates.assigned_to = parsed.data.assigned_to;
  if (parsed.data.internal_notes !== undefined) updates.internal_notes = parsed.data.internal_notes;

  if (Object.keys(updates).length === 0) {
    return { ok: false as const, error: "Nothing to update." };
  }

  const { error } = await sb
    .from("vifm_course_quote_requests")
    .update(updates)
    .eq("id", parsed.data.id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/admin/courses/quotes");
  revalidatePath(`/admin/courses/quotes/${parsed.data.id}`);
  return { ok: true as const };
}

/**
 * Email notification on new quote request. Uses the AC email
 * integration's `course_quote_request` template when Microsoft Graph
 * is configured. Falls back to a console.log mock otherwise (handled
 * inside sendEmail) so the form submission never fails because of
 * email config.
 */
async function maybeNotifySales(args: {
  requestId: string;
  requesterName: string;
  requesterEmail: string;
  requesterCompany: string;
  courseTitle: string;
  courseCode: string | null;
  groupSize: number | null;
  preferredStart: string | null;
  deliveryMode: string | null;
  preferredLanguage: string | null;
  notes: string | null;
}): Promise<void> {
  const salesAddress = process.env.VIFM_SALES_EMAIL ?? process.env.EMAIL_FROM_ADDRESS ?? null;
  if (!salesAddress) {
    console.log(
      `[quote-request] notification skipped (no VIFM_SALES_EMAIL env). Quote ${args.requestId} from ${args.requesterEmail}/${args.requesterCompany} on "${args.courseTitle}".`
    );
    return;
  }

  const { sendEmail } = await import("@/lib/integrations/email");
  await sendEmail({
    to: salesAddress,
    template: "course_quote_request",
    data: {
      courseTitle: args.courseTitle,
      courseCode: args.courseCode ? ` (${args.courseCode})` : "",
      requesterName: args.requesterName,
      requesterEmail: args.requesterEmail,
      requesterCompany: args.requesterCompany,
      groupSize: args.groupSize?.toString() ?? "—",
      preferredStart: args.preferredStart ?? "—",
      deliveryMode: args.deliveryMode ?? "—",
      preferredLanguage: args.preferredLanguage ?? "—",
      notes: args.notes ?? "(none)",
      adminUrl: `/admin/courses/quotes/${args.requestId}`,
    },
  });
}
