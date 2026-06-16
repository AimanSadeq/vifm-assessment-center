/**
 * Credential certificate PDF. Fetched by the owning candidate (or admin)
 * from the wallet. Accessed by the credential's uuid id (unguessable), the
 * same access model the Fluent certificate uses. Renders the generic
 * CredentialCertificate via React-PDF.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { CredentialCertificate } from "@/lib/reports/credential-certificate";
import { renderCredentialCertificateHtmlAr } from "@/lib/reports/credential-certificate-ar-html";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";
import { getServerLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPE_LABEL: Record<string, string> = {
  academy_completion: "Course Completion",
  ac_ready_now: "Assessment - Ready Now",
  fluent_cefr: "English Placement",
  technical_proficiency: "Technical Proficiency",
  ai_readiness: "AI Readiness",
};

// Arabic type labels, keyed by credential_type. Falls back to a generic
// "شهادة" (certificate) for any unmapped type.
const TYPE_LABEL_AR: Record<string, string> = {
  academy_completion: "إتمام دورة",
  ac_ready_now: "تقييم - جاهز الآن",
  fluent_cefr: "تحديد مستوى الإنجليزية",
  technical_proficiency: "الكفاءة التقنية",
  ai_readiness: "الجاهزية للذكاء الاصطناعي",
};

function fmt(iso?: string | null, locale: "en-GB" | "ar-AE" = "en-GB"): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

export async function GET(req: Request, { params }: { params: { credentialId: string } }) {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("vifm_credentials")
      .select("id, verification_code, issued_to_name, credential_type, title_en, title_ar, subtitle_en, subtitle_ar, score_pct, issued_at, expires_at, candidate_id")
      .eq("id", params.credentialId)
      .maybeSingle();
    if (error || !data) return new Response("Credential not found", { status: 404 });

    // Ownership: admin gets any certificate; a candidate gets only their own.
    // (The public, non-sensitive check lives at /verify/[code]; this is the
    // full certificate PDF.)
    const caller = await getCurrentCaller();
    if (!caller) return new Response("Unauthorized", { status: 401 });
    if (caller.role !== "admin") {
      if (caller.role !== "candidate" || !data.candidate_id) {
        return new Response("Forbidden", { status: 403 });
      }
      const { data: cand } = await sb
        .from("candidates")
        .select("profile_id")
        .eq("id", data.candidate_id)
        .maybeSingle<{ profile_id: string | null }>();
      if (!cand || cand.profile_id !== caller.uid) {
        return new Response("Forbidden", { status: 403 });
      }
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://caliber.viftraining.com";
    const verifyUrl = `${base}/verify/${data.verification_code}`;

    // Language: explicit ?lang= wins, else the server locale cookie. Only
    // "ar" routes to the Puppeteer path; everything else stays on React-PDF.
    const lang =
      ((new URL(req.url).searchParams.get("lang") ?? (await getServerLocale())) === "ar"
        ? "ar"
        : "en");

    // ── Arabic path: Puppeteer renders RTL HTML so Chromium can shape the
    //    Arabic glyphs React-PDF cannot. Mirrors the EN landscape layout.
    if (lang === "ar") {
      const html = renderCredentialCertificateHtmlAr({
        verificationCode: data.verification_code,
        name: data.issued_to_name,
        typeLabel: TYPE_LABEL_AR[data.credential_type] ?? "شهادة",
        titleAr: data.title_ar ?? data.title_en,
        subtitleAr: data.subtitle_ar ?? data.subtitle_en,
        scorePct: data.score_pct,
        issuedAt: fmt(data.issued_at, "ar-AE"),
        expiresAt: fmt(data.expires_at, "ar-AE"),
        verifyUrl,
      });
      const buffer = await renderHtmlToPdfBuffer(html, { landscape: true });
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="vifm-credential-${data.id}.pdf"`,
        },
      });
    }

    // ── English path: existing React-PDF renderer. Unchanged.
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
          verifyUrl,
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
