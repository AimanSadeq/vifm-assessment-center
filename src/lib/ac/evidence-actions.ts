"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, AuthorizationError } from "@/lib/ara/auth-guards";
import { suggestCompetencyValidationEvidence } from "@/lib/ai/ac-evidence-suggester";
import { isAIConfigured } from "@/lib/ai/client";
import type { ValidationEvidence } from "@/types/evidence";

/**
 * Server actions for the Assessment Center per-competency
 * validation-evidence trail (competencies.validation_evidence,
 * migration 00068). Mirrors the ARC actions in src/lib/ara/actions.ts
 * (suggestQuestionValidationEvidence / saveQuestionValidationEvidence).
 *
 * Auth: admin only. Evidence proposed by AI is saved with
 * review_status='ai_proposed' and is NOT surfaced to clients until an
 * admin verifies/edits it (the hallucination guard).
 */

function authErr(e: unknown) {
  if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
  return { ok: false as const, error: "Unexpected error" };
}

type CompetencyContext = {
  id: string;
  name: string;
  description: string | null;
  competency_clusters: {
    name: string;
    competency_domains: { name: string } | null;
  } | null;
};

async function loadCompetencyContext(competencyId: string) {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("competencies")
    .select("id, name, description, competency_clusters(name, competency_domains(name))")
    .eq("id", competencyId)
    .maybeSingle<CompetencyContext>();
  if (error || !data) return null;
  return data;
}

export async function suggestCompetencyEvidence(competencyId: string) {
  try {
    await requireRole("admin");
  } catch (e) {
    return authErr(e);
  }

  const ctx = await loadCompetencyContext(competencyId);
  if (!ctx) return { ok: false as const, error: "Competency not found" };

  const domainName = ctx.competency_clusters?.competency_domains?.name ?? "";

  const proposed = await suggestCompetencyValidationEvidence({
    competency_name: ctx.name,
    competency_description: ctx.description ?? "",
    domain_name: domainName,
  });

  if (!proposed) {
    return {
      ok: false as const,
      error:
        "AI suggester unavailable (ANTHROPIC_API_KEY not set, or the model returned an unparseable reply). You can still add anchors manually via Edit.",
    };
  }

  // Persist the ai_proposed evidence so it survives a reload. It stays
  // out of client deliverables until an admin verifies it.
  const sb = createServiceClient();
  const { error } = await sb
    .from("competencies")
    .update({ validation_evidence: proposed })
    .eq("id", competencyId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/admin/ac-evidence/${competencyId}`);
  revalidatePath("/admin/ac-evidence");
  revalidatePath("/admin/evidence-map");
  return { ok: true as const, evidence: proposed };
}

export async function saveCompetencyEvidence(
  competencyId: string,
  evidence: ValidationEvidence,
  reviewerEmail: string
) {
  try {
    await requireRole("admin");
  } catch (e) {
    return authErr(e);
  }

  const sb = createServiceClient();
  const stamped: ValidationEvidence = {
    ...evidence,
    reviewed_by: reviewerEmail || "admin@vifm.ae",
    reviewed_at: new Date().toISOString(),
  };

  const { error } = await sb
    .from("competencies")
    .update({ validation_evidence: stamped })
    .eq("id", competencyId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/admin/ac-evidence/${competencyId}`);
  revalidatePath("/admin/ac-evidence");
  revalidatePath("/admin/evidence-map");
  return { ok: true as const };
}

/**
 * Bulk evidence generation for the AC competencies. Processes a small
 * BATCH per call (so a hosted serverless request never times out making
 * dozens of AI calls) and reports how many remain, so a client button
 * can loop until done. Reuses the per-item action, which saves as
 * ai_proposed (never verified). Idempotent: skips human-touched items;
 * pass refresh to also redo items still in ai_proposed.
 */
export async function generateAllCompetencyEvidence(opts?: { batchSize?: number; refresh?: boolean }) {
  try {
    await requireRole("admin");
  } catch (e) {
    return authErr(e);
  }
  if (!isAIConfigured()) {
    return { ok: false as const, error: "ANTHROPIC_API_KEY is not set on the server, so the AI suggester can't run." };
  }
  const batchSize = opts?.batchSize ?? 6;
  const refresh = opts?.refresh ?? false;
  const sb = createServiceClient();

  const { data, error } = await sb.from("competencies").select("id, validation_evidence");
  if (error) return { ok: false as const, error: error.message };

  const pending = (data ?? []).filter(
    (row: { validation_evidence: { review_status?: string } | null }) => {
      const ev = row.validation_evidence;
      if (!ev) return true;
      if (ev.review_status === "ai_proposed") return refresh;
      return false; // verified / edited / rejected → leave human work alone
    }
  );

  const batch = pending.slice(0, batchSize) as Array<{ id: string }>;
  let processed = 0;
  let failed = 0;
  for (const row of batch) {
    const r = await suggestCompetencyEvidence(row.id);
    if (r.ok) processed++;
    else failed++;
  }

  revalidatePath("/admin/ac-evidence");
  revalidatePath("/admin/evidence-map");
  return { ok: true as const, processed, failed, remaining: pending.length - processed };
}
