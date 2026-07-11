"use server";

// Central "send all back to review" for the item-bank dashboard. Un-approves a
// whole bank's approved/live pool so an SME can review + edit before re-approving
// (the inverse of the bulk-approve). Admin-gated + service-role. Status-only
// updates for reliability across the six heterogeneous bank tables.

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";

type Result = { ok: true; count: number } | { ok: false; error: string };

export async function reopenBankForReviewAction(key: string): Promise<Result> {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false, error: "Not authorized." };
    throw e;
  }
  const svc = createServiceClient();

  const run = async (
    q: PromiseLike<{ data: Array<{ id: string }> | null; error: { message: string } | null }>,
  ): Promise<Result> => {
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/item-banks");
    return { ok: true, count: data?.length ?? 0 };
  };

  switch (key) {
    case "persona":
      return run(svc.from("persona_items").update({ status: "pending" }).eq("status", "approved").select("id"));
    case "logica": {
      // Reopen the whole approved COGNITIVE pool (not just source='seed_v1') so
      // manual + AI-drafted approved items are frozen for re-vetting too. But
      // psy_items is SHARED with the personality bank, so scope to the cognitive
      // instrument's scale ids - a bare status='approved' would also un-approve
      // personality items.
      const { data: cogInstruments } = await svc
        .from("psy_instruments").select("id").eq("kind", "cognitive");
      const cogInstrumentIds = (cogInstruments ?? []).map((i) => (i as { id: string }).id);
      if (cogInstrumentIds.length === 0) return { ok: true, count: 0 };
      const { data: cogScales } = await svc
        .from("psy_scales").select("id").in("instrument_id", cogInstrumentIds);
      const cogScaleIds = (cogScales ?? []).map((s) => (s as { id: string }).id);
      if (cogScaleIds.length === 0) return { ok: true, count: 0 };
      return run(
        svc.from("psy_items").update({ status: "in_review" })
          .eq("status", "approved").in("scale_id", cogScaleIds).select("id"),
      );
    }
    case "techno":
      return run(svc.from("tech_assessment_items").update({ status: "in_review" }).eq("status", "approved").select("id"));
    case "prehire":
      return run(svc.from("competency_quiz_items").update({ status: "in_review" }).eq("status", "approved").select("id"));
    case "fluent":
      return run(svc.from("eng_fluent_items").update({ status: "in_review" }).eq("status", "live").eq("source", "seed").select("id"));
    case "arc":
      return run(svc.from("ara_questions").update({ sme_status: "pending" }).eq("sme_status", "approved").select("id"));
    default:
      return { ok: false, error: "This bank has no review gate to reopen." };
  }
}
