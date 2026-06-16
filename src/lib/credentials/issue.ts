/**
 * VIFM Credentials - shared server-only issuer + verification reader.
 *
 * issueCredential() is called from server actions / API routes when a
 * certified outcome occurs (Academy course completion, an AC "Ready Now"
 * OAR, or a Fluent CEFR placement). It is best-effort: on failure it logs
 * and returns null rather than throwing, so it never blocks the primary
 * operation (an admin can re-issue from the admin panel).
 *
 * getCredentialForVerification() is the ONLY reader behind the public
 * /verify/[code] page + /api/credentials/verify/[code] route. It returns
 * non-sensitive fields only (never candidate_id, source_id, id, metadata).
 *
 * Both use createServiceClient() (untyped), so vifm_credentials compiles
 * before migration 00049 is applied; reads/writes no-op gracefully if the
 * table is absent.
 */
import { createServiceClient } from "@/lib/supabase/server";

export type CredentialType =
  | "academy_completion"
  | "ac_ready_now"
  | "fluent_cefr"
  | "technical_proficiency"
  | "ai_readiness";

// Default validity per credential type (renewable by issuing a fresh row).
// technical_proficiency is a measured competence claim, so it carries the
// shortest validity (1yr) - the holder re-certifies against the current
// SME-reviewed item bank to keep the claim current.
const EXPIRY_YEARS: Record<CredentialType, number> = {
  academy_completion: 3,
  ac_ready_now: 1,
  fluent_cefr: 1,
  technical_proficiency: 1,
  ai_readiness: 1,
};

function defaultExpiry(type: CredentialType): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + EXPIRY_YEARS[type]);
  return d.toISOString();
}

export type IssueCredentialArgs = {
  candidateId: string | null;
  issuedToName: string;
  issuedToEmail?: string | null;
  type: CredentialType;
  titleEn: string;
  titleAr?: string | null;
  subtitleEn?: string | null;
  subtitleAr?: string | null;
  scorePct?: number | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
  expiresAt?: string | null; // overrides the per-type default; pass null for no expiry
};

export async function issueCredential(
  args: IssueCredentialArgs
): Promise<{ verificationCode: string } | null> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("vifm_credentials")
      .insert({
        candidate_id: args.candidateId,
        issued_to_name: args.issuedToName,
        issued_to_email: args.issuedToEmail ?? null,
        credential_type: args.type,
        title_en: args.titleEn,
        title_ar: args.titleAr ?? null,
        subtitle_en: args.subtitleEn ?? null,
        subtitle_ar: args.subtitleAr ?? null,
        score_pct: args.scorePct ?? null,
        source_id: args.sourceId ?? null,
        metadata: args.metadata ?? {},
        expires_at: args.expiresAt === undefined ? defaultExpiry(args.type) : args.expiresAt,
      })
      .select("verification_code")
      .single();
    if (error || !data) {
      console.error("[credentials] issue failed:", error?.message?.slice(0, 120));
      return null;
    }
    return { verificationCode: data.verification_code as string };
  } catch (e) {
    console.error("[credentials] issue error:", e);
    return null;
  }
}

export type VerifiedCredential = {
  issuedToName: string;
  credentialType: CredentialType;
  titleEn: string;
  titleAr: string | null;
  subtitleEn: string | null;
  subtitleAr: string | null;
  issuer: string;
  scorePct: number | null;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public verification read. Returns only non-sensitive fields, or null. */
export async function getCredentialForVerification(
  code: string
): Promise<VerifiedCredential | null> {
  if (!code || !UUID_RE.test(code)) return null;
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("vifm_credentials")
      .select(
        "issued_to_name, credential_type, title_en, title_ar, subtitle_en, subtitle_ar, issuer, score_pct, issued_at, expires_at, revoked_at"
      )
      .eq("verification_code", code)
      .maybeSingle();
    if (error || !data) return null;
    return {
      issuedToName: data.issued_to_name,
      credentialType: data.credential_type,
      titleEn: data.title_en,
      titleAr: data.title_ar ?? null,
      subtitleEn: data.subtitle_en ?? null,
      subtitleAr: data.subtitle_ar ?? null,
      issuer: data.issuer,
      scorePct: data.score_pct ?? null,
      issuedAt: data.issued_at,
      expiresAt: data.expires_at ?? null,
      revokedAt: data.revoked_at ?? null,
    };
  } catch {
    return null;
  }
}
