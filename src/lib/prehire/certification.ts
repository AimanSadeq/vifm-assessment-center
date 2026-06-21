import { createServiceClient } from "@/lib/supabase/server";

/**
 * Pre-Hire SME certification (migration 00145). A candidate is "certified" once
 * a VIFM assessor has reviewed their AI-scored responses and stamped the result.
 * All reads are best-effort + tolerant of the migration not being applied (the
 * candidate simply reads as not-certified).
 */
export type PrehireCertification = {
  certifiedAt: string;
  certifiedBy: string | null;
  notes: string | null;
};

export async function getPrehireCertification(
  candidateId: string
): Promise<PrehireCertification | null> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("prehire_candidates")
      .select("certified_at, certified_by, certification_notes")
      .eq("id", candidateId)
      .maybeSingle<{
        certified_at: string | null;
        certified_by: string | null;
        certification_notes: string | null;
      }>();
    if (!data?.certified_at) return null;
    return {
      certifiedAt: data.certified_at,
      certifiedBy: data.certified_by,
      notes: data.certification_notes,
    };
  } catch {
    return null;
  }
}
