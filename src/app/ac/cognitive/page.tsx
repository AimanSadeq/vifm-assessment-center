import { PsychometricsClient, type EngagementOption } from "./_components/psychometrics-client";
import { AllServicesLink } from "@/components/shared/all-services-link";
import { BackLink } from "@/components/shared/back-link";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Engagements (with their candidates) for the Persona candidate picker. */
async function loadEngagementOptions(): Promise<EngagementOption[]> {
  try {
    const sb = createServiceClient();
    const [{ data: engs }, { data: cands }] = await Promise.all([
      sb.from("engagements").select("id, name, created_at").order("created_at", { ascending: false }),
      sb.from("candidates").select("id, full_name, engagement_id"),
    ]);
    const byEng = new Map<string, { id: string; full_name: string }[]>();
    for (const c of cands ?? []) {
      const eid = c.engagement_id as string;
      if (!byEng.has(eid)) byEng.set(eid, []);
      byEng.get(eid)!.push({ id: c.id as string, full_name: (c.full_name as string) ?? "—" });
    }
    return (engs ?? [])
      .map((e) => ({ id: e.id as string, name: (e.name as string) ?? "—", candidates: byEng.get(e.id as string) ?? [] }))
      .filter((e) => e.candidates.length > 0);
  } catch {
    return [];
  }
}

/**
 * Psychometrics runner (Tier 1 indicative) — cognitive ability. The behavioural
 * instrument is Persona (the 38-competency self-assessment), launched from here.
 * Self-served; an admin can bind a result to a candidate/engagement via
 * ?candidateId=…&engagementId=… (mirrors the Fluent runner), or pick a candidate
 * in the Persona card.
 */
export default async function PsychometricsPage({
  searchParams,
}: {
  searchParams?: { candidateId?: string; engagementId?: string };
}) {
  const engagements = await loadEngagementOptions();
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/" label="Back" history />
      <div className="mb-4 flex justify-end">
        <AllServicesLink />
      </div>
      <PsychometricsClient
        candidateId={searchParams?.candidateId ?? null}
        engagementId={searchParams?.engagementId ?? null}
        engagements={engagements}
      />
    </div>
  );
}
