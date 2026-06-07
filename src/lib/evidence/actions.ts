"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, AuthorizationError } from "@/lib/ara/auth-guards";
import { isAIConfigured } from "@/lib/ai/client";
import { getEvidenceAdapter } from "@/lib/evidence/instruments";
import type { ValidationEvidence } from "@/types/evidence";

/**
 * Generic validation-evidence server actions shared by the four
 * adapter-driven instruments (Fluent, Technical, Reflect, Psychometrics).
 * Mirrors the bespoke AC actions (src/lib/ac/evidence-actions.ts) but is
 * parameterised by an instrument key resolved to an adapter. Admin only;
 * AI output is saved as ai_proposed and never surfaced to clients until
 * a human verifies/edits it.
 */

function authErr(e: unknown) {
  if (e instanceof AuthorizationError) return { ok: false as const, error: e.message };
  return { ok: false as const, error: "Unexpected error" };
}

export async function suggestEvidence(instrumentKey: string, id: string) {
  try {
    await requireRole("admin");
  } catch (e) {
    return authErr(e);
  }
  const adapter = getEvidenceAdapter(instrumentKey);
  if (!adapter) return { ok: false as const, error: "Unknown instrument" };

  const proposed = await adapter.suggestOne(id);
  if (!proposed) {
    return {
      ok: false as const,
      error:
        "AI suggester unavailable (ANTHROPIC_API_KEY not set, or the model returned an unparseable reply). You can still add anchors manually via Edit.",
    };
  }

  const sb = createServiceClient();
  const { error } = await sb.from(adapter.table).update({ validation_evidence: proposed }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(adapter.basePath);
  revalidatePath(`${adapter.basePath}/${id}`);
  revalidatePath("/admin/evidence-map");
  return { ok: true as const, evidence: proposed };
}

export async function saveEvidence(
  instrumentKey: string,
  id: string,
  evidence: ValidationEvidence,
  reviewerEmail: string
) {
  try {
    await requireRole("admin");
  } catch (e) {
    return authErr(e);
  }
  const adapter = getEvidenceAdapter(instrumentKey);
  if (!adapter) return { ok: false as const, error: "Unknown instrument" };

  const sb = createServiceClient();
  const stamped: ValidationEvidence = {
    ...evidence,
    reviewed_by: reviewerEmail || "admin@vifm.ae",
    reviewed_at: new Date().toISOString(),
  };
  const { error } = await sb.from(adapter.table).update({ validation_evidence: stamped }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(adapter.basePath);
  revalidatePath(`${adapter.basePath}/${id}`);
  revalidatePath("/admin/evidence-map");
  return { ok: true as const };
}

/**
 * Bulk drafting for an adapter-driven instrument. Processes a small batch
 * per call (keeps a hosted request under its timeout) and reports how
 * many remain so a client button can loop. Idempotent: skips
 * human-touched items; pass refresh to redo items still in ai_proposed.
 */
export async function generateAllEvidence(
  instrumentKey: string,
  opts?: { batchSize?: number; refresh?: boolean }
) {
  try {
    await requireRole("admin");
  } catch (e) {
    return authErr(e);
  }
  if (!isAIConfigured()) {
    return { ok: false as const, error: "ANTHROPIC_API_KEY is not set on the server, so the AI suggester can't run." };
  }
  const adapter = getEvidenceAdapter(instrumentKey);
  if (!adapter) return { ok: false as const, error: "Unknown instrument" };

  const batchSize = opts?.batchSize ?? 6;
  const refresh = opts?.refresh ?? false;

  const items = await adapter.listItems();
  const pending = items.filter((it) => {
    const ev = it.evidence;
    if (!ev) return true;
    if (ev.review_status === "ai_proposed") return refresh;
    return false; // verified / edited / rejected → leave human work alone
  });

  const batch = pending.slice(0, batchSize);
  let processed = 0;
  let failed = 0;
  for (const it of batch) {
    const r = await suggestEvidence(instrumentKey, it.id);
    if (r.ok) processed++;
    else failed++;
  }

  return { ok: true as const, processed, failed, remaining: pending.length - processed };
}
