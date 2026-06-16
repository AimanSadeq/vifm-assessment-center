"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { techDomainByKey } from "@/lib/competencies/technical-framework";
import { createClientOrganization } from "@/lib/clients/registry";

type Result<T = unknown> = ({ ok: true } & T) | { error: string };

async function guard(): Promise<{ ok: true } | { error: string }> {
  try {
    await requireRole(["admin"]);
    return { ok: true };
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

/** Resolve a function ref (standard key or custom id) → technical_functions.id. */
async function resolveFunctionId(
  sb: ReturnType<typeof createServiceClient>,
  ref: string
): Promise<string | null> {
  const byKey = await sb.from("technical_functions").select("id").eq("key", ref).maybeSingle();
  if (byKey.data?.id) return byKey.data.id as string;
  if (UUID_RE.test(ref)) {
    const byId = await sb.from("technical_functions").select("id").eq("id", ref).maybeSingle();
    if (byId.data?.id) return byId.data.id as string;
  }
  return null;
}

export async function createProgramAction(input: {
  name: string;
  organizationName: string;
  functionRef: string;
}): Promise<Result<{ id: string }>> {
  const g = await guard();
  if ("error" in g) return g;
  const name = input.name.trim();
  const org = input.organizationName.trim();
  const ref = input.functionRef?.trim();
  if (!name || !org) return { error: "Name and organization are required." };
  if (!ref) return { error: "Pick a function for this program." };

  try {
    const sb = createServiceClient();
    const functionId = await resolveFunctionId(sb, ref);
    if (!functionId) return { error: "That function isn't available. Apply migration 00058 and try again." };

    // Register the client first-class via the shared registry (dual-write to
    // organizations + ara_organizations, deduped by name) so the program's org
    // is a real platform client reusable across services. Best-effort: a
    // registry hiccup falls back to the name-only program below.
    let organizationId: string | null = null;
    try {
      const reg = await createClientOrganization({ name: org });
      if (reg.ok) organizationId = reg.organizationId;
    } catch {
      /* fall back to name-only */
    }

    // A program is a function team; tier keeps its DB default (vestigial).
    const { data, error } = await sb
      .from("technical_programs")
      .insert({ name, organization_name: org, status: "active", function_id: functionId })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "Could not create program." };

    // Link the FK (best-effort; the column lands with migration 00103, so this
    // no-ops cleanly until then).
    if (organizationId) {
      await sb.from("technical_programs").update({ organization_id: organizationId }).eq("id", data.id);
    }

    revalidatePath("/admin/tech-assessment/programs");
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create program." };
  }
}

export async function setProgramDomainAction(input: {
  programId: string;
  domainKey: string;
  inScope: boolean;
}): Promise<Result> {
  const g = await guard();
  if ("error" in g) return g;
  if (!techDomainByKey(input.domainKey)) return { error: "unknown domain" };

  try {
    const sb = createServiceClient();
    if (input.inScope) {
      const { error } = await sb
        .from("technical_program_domains")
        .upsert({ program_id: input.programId, domain_key: input.domainKey }, { onConflict: "program_id,domain_key" });
      if (error) return { error: error.message };
    } else {
      const { error } = await sb
        .from("technical_program_domains")
        .delete()
        .eq("program_id", input.programId)
        .eq("domain_key", input.domainKey);
      if (error) return { error: error.message };
    }
    revalidatePath(`/admin/tech-assessment/programs/${input.programId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update scope." };
  }
}

export async function addParticipantAction(input: {
  programId: string;
  fullName: string;
  email?: string;
}): Promise<Result<{ id: string; accessToken: string }>> {
  const g = await guard();
  if ("error" in g) return g;
  const fullName = input.fullName.trim();
  if (!fullName) return { error: "Participant name is required." };

  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("technical_program_participants")
      .insert({ program_id: input.programId, full_name: fullName, email: input.email?.trim() || null })
      .select("id, access_token")
      .single();
    if (error || !data) return { error: error?.message ?? "Could not add participant." };
    revalidatePath(`/admin/tech-assessment/programs/${input.programId}`);
    return { ok: true, id: data.id as string, accessToken: data.access_token as string };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not add participant." };
  }
}

export async function removeParticipantAction(input: {
  programId: string;
  participantId: string;
}): Promise<Result> {
  const g = await guard();
  if ("error" in g) return g;
  try {
    const sb = createServiceClient();
    const { error } = await sb.from("technical_program_participants").delete().eq("id", input.participantId);
    if (error) return { error: error.message };
    revalidatePath(`/admin/tech-assessment/programs/${input.programId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not remove participant." };
  }
}
