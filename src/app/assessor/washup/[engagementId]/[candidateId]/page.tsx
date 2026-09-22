export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { WashupForm } from "./_components/washup-form";
import { BackLink } from "@/components/shared/back-link";

type Props = {
  params: { engagementId: string; candidateId: string };
};

export default async function WashupCandidatePage({ params }: Props) {
  const supabase = await createClient();
  const { engagementId, candidateId } = params;

  const [engResult, candResult, compResult, worksheetsResult, consensusResult, oarResult] =
    await Promise.all([
      supabase.from("engagements").select("id, name, purpose, integration_method, weights_confirmed_at, other_methods_rule, other_methods_note, external_evidence_rule, external_evidence_framework").eq("id", engagementId).single(),
      supabase.from("candidates").select("id, full_name").eq("id", candidateId).single(),
      supabase
        .from("engagement_competencies")
        .select("competency_id, weight, competencies(id, name, description)")
        .eq("engagement_id", engagementId),
      // All assessors' integration worksheets for this candidate
      supabase
        .from("integration_worksheets")
        .select("*, profiles(full_name)")
        .eq("engagement_id", engagementId)
        .eq("candidate_id", candidateId),
      // Existing consensus ratings
      supabase
        .from("consensus_ratings")
        .select("*")
        .eq("engagement_id", engagementId)
        .eq("candidate_id", candidateId),
      // Existing OAR
      supabase
        .from("overall_assessment_ratings")
        .select("*")
        .eq("engagement_id", engagementId)
        .eq("candidate_id", candidateId)
        .maybeSingle(),
    ]);

  if (engResult.error || !engResult.data || candResult.error || !candResult.data) {
    return notFound();
  }

  const competencies = (compResult.data ?? []).map((c) => ({
    ...(c.competencies as unknown as { id: string; name: string; description: string | null }),
    weight: c.weight,
  }));

  // Guard: wash-up consolidates the assessors' integration worksheets into
  // consensus ratings and an OAR. If competencies exist but NO worksheet has
  // been submitted, there is nothing to consolidate - show a clear "no
  // observations yet" state instead of a blank consensus grid that would invite
  // a baseless overall rating.
  if (competencies.length > 0 && (worksheetsResult.data ?? []).length === 0) {
    return (
      <div>
        <BackLink href="/assessor" label="Back" history />
        <div className="mx-auto mt-6 max-w-xl rounded-lg border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-base font-semibold text-amber-900">No observations recorded yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            No assessor integration worksheets have been submitted for {candResult.data.full_name} yet.
            Wash-up consolidates those worksheets into the consensus ratings and the overall rating, so
            please wait until at least one assessor has completed their observations and integration
            worksheet before running the wash-up.
          </p>
          <Link
            href={`/assessor/assignments/${engagementId}`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            Go to assessor assignments
          </Link>
        </div>
      </div>
    );
  }

  // Who can chair (BPS 7.10). Anyone named Feedback Generation Meeting Chair or
  // Centre Manager for this centre comes first, because those are the people
  // the design made answerable; the rest of the centre's staff follow, so a
  // centre that has not filled those roles yet can still run its wash-up.
  const namedChairIds = new Set<string>();
  const chairRoleRows = await supabase
    .from("ac_engagement_roles")
    .select("profile_id, role_key")
    .eq("engagement_id", engagementId)
    .in("role_key", ["feedback_meeting_chair", "centre_manager"])
    .then((r) => (r.data ?? []) as { profile_id: string; role_key: string }[], () => []);
  for (const r of chairRoleRows) namedChairIds.add(r.profile_id);

  const staff = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .not("role", "in", "(candidate,client)")
    .order("full_name")
    .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]);

  const chairCandidates = staff
    .map((p) => ({
      id: p.id as string,
      name: (p.full_name as string) ?? (p.email as string) ?? "Unnamed",
      isNamedChair: namedChairIds.has(p.id as string),
    }))
    .sort((a, b) => Number(b.isNamedChair) - Number(a.isNamedChair) || a.name.localeCompare(b.name));

  return (
    <div>
      <BackLink href="/assessor" label="Back" history />
      <WashupForm
        engagementId={engagementId}
        engagementName={engResult.data.name}
        engagement={{
          purpose: (engResult.data as { purpose?: string | null }).purpose ?? null,
          integration_method: (engResult.data as { integration_method?: string | null }).integration_method ?? null,
          weights_confirmed_at: (engResult.data as { weights_confirmed_at?: string | null }).weights_confirmed_at ?? null,
          other_methods_rule: (engResult.data as { other_methods_rule?: string | null }).other_methods_rule ?? null,
          other_methods_note: (engResult.data as { other_methods_note?: string | null }).other_methods_note ?? null,
          external_evidence_rule: (engResult.data as { external_evidence_rule?: string | null }).external_evidence_rule ?? null,
          external_evidence_framework: (engResult.data as { external_evidence_framework?: string | null }).external_evidence_framework ?? null,
        }}
        chairCandidates={chairCandidates}
        candidateId={candidateId}
        candidateName={candResult.data.full_name}
        competencies={competencies}
        worksheets={worksheetsResult.data ?? []}
        existingConsensus={consensusResult.data ?? []}
        existingOar={oarResult.data}
      />
    </div>
  );
}
