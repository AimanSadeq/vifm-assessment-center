"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";

const uuidShape = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const bulkAssignSchema = z.object({
  rows: z
    .array(
      z.object({
        email: z.string().email(),
        roleProfileId: uuidShape.nullable(),
      })
    )
    .min(1)
    .max(2000),
});

export type BulkAssignRowResult = {
  email: string;
  status: "updated" | "no_candidate" | "no_change" | "error";
  candidateId?: string;
  candidateName?: string;
  message?: string;
};

/**
 * G5 - Bulk user-to-persona linking.
 *
 * Match candidates by email, set role_profile_id (or null to clear).
 * Returns one row per input so the UI can show a per-row status table.
 *
 * Implementation note: matches are done per-row to keep RLS in play and
 * to give the user precise feedback. The 2000-row cap is generous -
 * larger imports should use Supabase's CSV-based bulk loader directly.
 */
export async function bulkAssignRoleProfilesAction(input: {
  rows: { email: string; roleProfileId: string | null }[];
}) {
  // Defence-in-depth: bulk operations are admin-only at the action layer
  // even though RLS already requires admin to write to candidates.
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }

  const parsed = bulkAssignSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const results: BulkAssignRowResult[] = [];

  // Postgres LIKE/ILIKE treats `%` and `_` as wildcards. A CSV row like
  // `t_st@example.com` would otherwise broaden the match unexpectedly.
  // Escape both characters before passing to ilike.
  const escapeLikeWildcards = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

  for (const row of parsed.data.rows) {
    const trimmedEmail = row.email.trim().toLowerCase();
    const { data: matches, error: findErr } = await supabase
      .from("candidates")
      .select("id, full_name, role_profile_id")
      .ilike("email", escapeLikeWildcards(trimmedEmail));

    if (findErr) {
      results.push({
        email: row.email,
        status: "error",
        message: findErr.message,
      });
      continue;
    }
    if (!matches || matches.length === 0) {
      results.push({ email: row.email, status: "no_candidate" });
      continue;
    }

    // If multiple candidates share the email (different engagements), update all.
    let touched = 0;
    for (const c of matches) {
      if (c.role_profile_id === row.roleProfileId) {
        continue;
      }
      const { error: updateErr } = await supabase
        .from("candidates")
        .update({ role_profile_id: row.roleProfileId })
        .eq("id", c.id);
      if (updateErr) {
        results.push({
          email: row.email,
          status: "error",
          candidateId: c.id,
          candidateName: c.full_name,
          message: updateErr.message,
        });
        continue;
      }
      touched += 1;
      results.push({
        email: row.email,
        status: "updated",
        candidateId: c.id,
        candidateName: c.full_name,
      });
    }
    if (touched === 0 && matches.length > 0) {
      results.push({
        email: row.email,
        status: "no_change",
        candidateId: matches[0].id,
        candidateName: matches[0].full_name,
      });
    }
  }

  const summary = {
    updated: results.filter((r) => r.status === "updated").length,
    noCandidate: results.filter((r) => r.status === "no_candidate").length,
    noChange: results.filter((r) => r.status === "no_change").length,
    errors: results.filter((r) => r.status === "error").length,
  };

  return { results, summary };
}
