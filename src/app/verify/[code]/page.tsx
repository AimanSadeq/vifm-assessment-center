import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { getCredentialForVerification } from "@/lib/credentials/issue";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Verify credential · VIFM",
  description: "Verify a credential issued by the Virginia Institute of Finance and Management.",
};

// Public, English-only. A revoked or expired credential still resolves, but
// is shown as not currently valid.
const TYPE_LABEL: Record<string, string> = {
  academy_completion: "Course Completion",
  ac_ready_now: "Assessment - Ready Now",
  fluent_cefr: "English Placement",
};

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export default async function VerifyCredentialPage({ params }: { params: { code: string } }) {
  const cred = await getCredentialForVerification(params.code);
  const revoked = !!cred?.revokedAt;
  const expired = cred?.expiresAt ? new Date(cred.expiresAt) < new Date() : false;
  const valid = !!cred && !revoked && !expired;

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-2xl px-6 py-5">
          <VifmLogo variant="color" size="sm" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        {!cred ? (
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <ShieldX className="mx-auto h-10 w-10 text-slate-400" />
            <h1 className="mt-3 text-xl font-semibold text-[#010131]">Credential not found</h1>
            <p className="mt-2 text-sm text-slate-500">
              We could not find a credential with this verification code. Check the code and try again.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              {valid ? (
                <ShieldCheck className="h-10 w-10 shrink-0 text-emerald-600" />
              ) : revoked ? (
                <ShieldX className="h-10 w-10 shrink-0 text-rose-600" />
              ) : (
                <ShieldAlert className="h-10 w-10 shrink-0 text-amber-600" />
              )}
              <div>
                <div className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                  {valid ? "Credential verified" : revoked ? "Credential revoked" : "Credential expired"}
                </div>
                <div className="text-xs text-slate-400">Issued by {cred.issuer}</div>
              </div>
            </div>

            <div className="mt-6 border-t pt-6">
              <div className="text-xs font-medium uppercase tracking-wide text-[#5391D5]">
                {TYPE_LABEL[cred.credentialType] ?? "Credential"}
              </div>
              <h1 className="mt-1 text-2xl font-semibold text-[#010131]">{cred.titleEn}</h1>
              {cred.titleAr && (
                <p dir="rtl" className="mt-1 text-lg text-slate-600">
                  {cred.titleAr}
                </p>
              )}
              {cred.subtitleEn && <p className="mt-2 text-sm text-slate-500">{cred.subtitleEn}</p>}

              <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
                <Field label="Awarded to" value={cred.issuedToName} />
                {cred.scorePct != null && <Field label="Score" value={`${cred.scorePct}%`} />}
                <Field label="Issued" value={fmtDate(cred.issuedAt) ?? "-"} />
                {cred.expiresAt && (
                  <Field
                    label={expired ? "Expired" : "Valid until"}
                    value={fmtDate(cred.expiresAt) ?? "-"}
                  />
                )}
              </dl>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Credential verification · caliber.viftraining.com
        </p>
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-[#010131]">{value}</dd>
    </div>
  );
}
