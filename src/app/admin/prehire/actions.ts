"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";

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

const stageEntrySchema = z.object({
  kind: z.enum(["fluent", "quiz", "cbi", "assessment_center"]),
  weight: z.coerce.number().min(0).max(1),
  cut_score: z.coerce.number().min(0).max(100).nullable(),
  required: z.boolean(),
});

const requisitionSchema = z.object({
  organization_id: z.string().uuid("Select a client organization"),
  title: z.string().min(2, "Title is required").max(160),
  role_profile_id: z.string().uuid().nullable().optional(),
  level: z.string().max(60).optional(),
  english_required: z.boolean().optional(),
  stage_config: z.array(stageEntrySchema).min(1, "Pick at least one screening stage"),
});

export async function createRequisitionAction(input: unknown) {
  const gate = await gateAdmin();
  if (gate) return gate;

  const parsed = requisitionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join("; ") || "Invalid requisition" };
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("prehire_requisitions")
    .insert({
      organization_id: parsed.data.organization_id,
      title: parsed.data.title,
      role_profile_id: parsed.data.role_profile_id ?? null,
      level: parsed.data.level || null,
      english_required: parsed.data.english_required ?? false,
      stage_config: parsed.data.stage_config,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create requisition" };

  revalidatePath("/admin/prehire");
  return { data: { id: data.id as string } };
}

const candidateSchema = z.object({
  requisition_id: z.string().uuid(),
  full_name: z.string().min(2, "Name is required").max(160),
  email: z.string().email("Valid email required"),
  phone: z.string().max(40).optional(),
});

export async function addCandidateAction(input: unknown) {
  const gate = await gateAdmin();
  if (gate) return gate;

  const parsed = candidateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join("; ") || "Invalid candidate" };
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("prehire_candidates")
    .insert({
      requisition_id: parsed.data.requisition_id,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      status: "invited",
      invited_at: new Date().toISOString(),
    })
    .select("id, access_token")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not add candidate" };

  // Invitation email is wired in a later slice; for now surface the apply link.
  revalidatePath(`/admin/prehire/${parsed.data.requisition_id}`);
  return { data: { id: data.id as string, access_token: data.access_token as string } };
}
