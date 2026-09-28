/**
 * Loads what the centre agreement needs from one engagement. Takes the client
 * it is given (the route passes the service client after an admin check), so
 * it never decides access itself.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgreementInput } from "./centre-agreement-prefill";

const nameOf = (row: unknown): string => {
  const c = row as { name?: string } | { name?: string }[] | null;
  return (Array.isArray(c) ? c[0]?.name : c?.name) ?? "Unnamed criterion";
};

type ExerciseRow = { id: string; name: string; exercise_type: string | null; duration_minutes: number | null };

export async function loadAgreementInput(
  sb: SupabaseClient,
  engagementId: string,
  generatedAt: string
): Promise<{ engagement: Record<string, unknown>; input: AgreementInput } | null> {
  const { data: engagement } = await sb
    .from("engagements")
    .select("*, organizations(name)")
    .eq("id", engagementId)
    .maybeSingle();
  if (!engagement) return null;

  const [compRows, exRows, matrixRows, roleRows, candCount] = await Promise.all([
    sb.from("engagement_competencies").select("competency_id, weight, competencies(name)").eq("engagement_id", engagementId),
    sb.from("engagement_exercises").select("exercise_id, exercises(id, name, exercise_type, duration_minutes)").eq("engagement_id", engagementId),
    sb.from("exercise_competency_matrix").select("exercise_id, competencies(name)").eq("engagement_id", engagementId),
    sb
      .from("ac_engagement_roles")
      .select("role_key, is_external, profiles(full_name, email)")
      .eq("engagement_id", engagementId)
      .then((r) => r, () => ({ data: null })),
    sb.from("candidates").select("id", { count: "exact", head: true }).eq("engagement_id", engagementId),
  ]);

  // Same measure the candidate report states (8.12): of the behavioural
  // indicators behind this centre's competencies, how many an SME has approved.
  const compIds = (compRows.data ?? []).map((c) => c.competency_id as string);
  const contentApproved = compIds.length
    ? await sb
        .from("behavioral_indicators")
        .select("sme_status")
        .in("competency_id", compIds)
        .then(
          (r) => {
            const rows = (r.data ?? []) as { sme_status?: string | null }[];
            if (r.error || rows.length === 0) return null;
            return { approved: rows.filter((x) => x.sme_status === "approved").length, total: rows.length };
          },
          () => null
        )
    : null;

  const byExercise = new Map<string, string[]>();
  for (const m of matrixRows.data ?? []) {
    const arr = byExercise.get(m.exercise_id as string) ?? [];
    arr.push(nameOf(m.competencies));
    byExercise.set(m.exercise_id as string, arr);
  }

  const org = engagement.organizations as unknown as { name?: string } | { name?: string }[] | null;
  return {
    engagement: engagement as Record<string, unknown>,
    input: {
      engagement: engagement as Record<string, unknown>,
      organisationName: (Array.isArray(org) ? org[0]?.name : org?.name) ?? null,
      competencies: (compRows.data ?? []).map((c) => ({
        name: nameOf(c.competencies),
        weight: (c.weight as number | null) ?? null,
      })),
      exercises: (exRows.data ?? [])
        .map((x) => x.exercises as unknown as ExerciseRow | null)
        .filter((x): x is ExerciseRow => Boolean(x))
        .map((x) => ({
          name: x.name,
          exerciseType: x.exercise_type,
          durationMinutes: x.duration_minutes,
          competencies: byExercise.get(x.id) ?? [],
        })),
      roles: ((roleRows as { data: Record<string, unknown>[] | null }).data ?? []).map((r) => {
        const p = r.profiles as unknown as { full_name?: string | null; email?: string | null } | null;
        return { roleKey: r.role_key as string, name: p?.full_name ?? p?.email ?? "Unnamed", isExternal: Boolean(r.is_external) };
      }),
      participantCount: candCount.count ?? 0,
      contentApproved,
      generatedAt,
    },
  };
}
