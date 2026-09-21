export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ConsentForm } from "./_components/consent-form";

type Props = { params: { candidateId: string } };

/**
 * Consent is only informed if the participant was given the facts first
 * (BPS 3.17, 5.39, 5.41), so the form is told what this centre actually says:
 * who receives the report, how long results are kept, whether they may be used
 * in research, and whether this participant has read the pack yet.
 */
export default async function ConsentPage({ params }: Props) {
  const supabase = await createClient();
  const { candidateId } = params;

  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("id, engagement_id, pack_ack_at")
    .eq("id", candidateId)
    .maybeSingle();
  if (error || !candidate) return notFound();

  // The engagement is not readable by a participant, so this is scoped to the
  // one engagement their own candidate row belongs to.
  const sb = createServiceClient();
  const { data: eng } = await sb
    .from("engagements")
    .select("pack_published_at, pack_report_recipients, retention_months, research_use")
    .eq("id", candidate.engagement_id as string)
    .maybeSingle();

  return (
    <ConsentForm
      candidateId={candidateId}
      pack={{
        published: Boolean(eng?.pack_published_at),
        acknowledged: Boolean(candidate.pack_ack_at),
        reportRecipients: (eng?.pack_report_recipients as string | null) ?? null,
        retentionMonths: (eng?.retention_months as number | null) ?? 24,
        researchUse: Boolean(eng?.research_use),
      }}
    />
  );
}
