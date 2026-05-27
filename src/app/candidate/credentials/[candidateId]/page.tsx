import Link from "next/link";
import { ArrowLeft, Award, ShieldCheck, ShieldX, Download } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "My Credentials · VIFM" };

type Credential = {
  id: string;
  verification_code: string;
  credential_type: string;
  title_en: string;
  subtitle_en: string | null;
  issued_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  academy_completion: "Course Completion",
  ac_ready_now: "Assessment - Ready Now",
  fluent_cefr: "English Placement",
};

function fmt(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

export default async function CandidateCredentialsPage({ params }: { params: { candidateId: string } }) {
  let creds: Credential[] = [];
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("vifm_credentials")
      .select("id, verification_code, credential_type, title_en, subtitle_en, issued_at, expires_at, revoked_at")
      .eq("candidate_id", params.candidateId)
      .order("issued_at", { ascending: false });
    creds = (data ?? []) as Credential[];
  } catch {
    /* table not migrated yet - show empty state */
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href={`/candidate/welcome/${params.candidateId}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <Award className="h-6 w-6 text-[#5391D5]" />
        <h1 className="text-2xl font-semibold text-[#010131]">My Credentials</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Verifiable credentials issued by VIFM. Share the verification link or download the certificate.
      </p>

      {creds.length === 0 ? (
        <div className="mt-8 rounded-xl border bg-white p-8 text-center text-sm text-muted-foreground">
          You have no credentials yet. Complete a course or assessment to earn one.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {creds.map((c) => {
            const revoked = !!c.revoked_at;
            const expired = c.expires_at ? new Date(c.expires_at) < new Date() : false;
            return (
              <div key={c.id} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-[#5391D5]">
                      {TYPE_LABEL[c.credential_type] ?? "Credential"}
                    </div>
                    <h2 className="mt-0.5 font-semibold text-[#010131]">{c.title_en}</h2>
                    {c.subtitle_en && <p className="mt-1 text-sm text-slate-500">{c.subtitle_en}</p>}
                    <p className="mt-2 text-xs text-slate-400">
                      Issued {fmt(c.issued_at)}
                      {c.expires_at ? ` · ${expired ? "expired" : "valid until"} ${fmt(c.expires_at)}` : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      revoked || expired ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {revoked ? (
                      <>
                        <ShieldX className="h-3 w-3" /> Revoked
                      </>
                    ) : expired ? (
                      <>
                        <ShieldX className="h-3 w-3" /> Expired
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3 w-3" /> Valid
                      </>
                    )}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                  <Link
                    href={`/verify/${c.verification_code}`}
                    className="inline-flex items-center gap-1.5 font-medium text-[#5391D5] hover:underline"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> Verify
                  </Link>
                  <a
                    href={`/api/credentials/${c.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-[#010131] hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" /> Download certificate
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
