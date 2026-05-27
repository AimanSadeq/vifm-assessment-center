/**
 * Credential certificate PDF. Fetched by the owning candidate (or admin)
 * from the wallet. Accessed by the credential's uuid id (unguessable), the
 * same access model the Fluent certificate uses. Renders the generic
 * CredentialCertificate via React-PDF.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { createServiceClient } from "@/lib/supabase/server";
import { CredentialCertificate } from "@/lib/reports/credential-certificate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPE_LABEL: Record<string, string> = {
  academy_completion: "Course Completion",
  ac_ready_now: "Assessment - Ready Now",
  fluent_cefr: "English Placement",
};

function fmt(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

export async function GET(_req: Request, { params }: { params: { credentialId: string } }) {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("vifm_credentials")
      .select("id, verification_code, issued_to_name, credential_type, title_en, subtitle_en, score_pct, issued_at, expires_at")
      .eq("id", params.credentialId)
      .maybeSingle();
    if (error || !data) return new Response("Credential not found", { status: 404 });

    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://caliber.viftraining.com";
    const buffer = await renderToBuffer(
      <CredentialCertificate
        data={{
          verificationCode: data.verification_code,
          name: data.issued_to_name,
          typeLabel: TYPE_LABEL[data.credential_type] ?? "Credential",
          titleEn: data.title_en,
          subtitleEn: data.subtitle_en,
          scorePct: data.score_pct,
          issuedAt: fmt(data.issued_at),
          expiresAt: fmt(data.expires_at),
          verifyUrl: `${base}/verify/${data.verification_code}`,
        }}
      />
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="vifm-credential-${data.id}.pdf"`,
      },
    });
  } catch (e) {
    console.error("[credentials] pdf error:", e);
    return new Response("Error generating certificate", { status: 500 });
  }
}
