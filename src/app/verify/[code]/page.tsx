import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { getCredentialForVerification } from "@/lib/credentials/issue";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getServerT();
  return {
    title: t("authPublic.verify.metaTitle"),
    description: t("authPublic.verify.metaDescription"),
  };
}

// Public, bilingual. A revoked or expired credential still resolves, but
// is shown as not currently valid.
const TYPE_LABEL_KEY: Record<string, string> = {
  academy_completion: "authPublic.verify.typeAcademyCompletion",
  ac_ready_now: "authPublic.verify.typeAcReadyNow",
  fluent_cefr: "authPublic.verify.typeFluentCefr",
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
  const t = await getServerT();
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
            <h1 className="mt-3 text-xl font-semibold text-[#010131]">{t("authPublic.verify.notFoundTitle")}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {t("authPublic.verify.notFoundBody")}
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
                  {valid ? t("authPublic.verify.statusVerified") : revoked ? t("authPublic.verify.statusRevoked") : t("authPublic.verify.statusExpired")}
                </div>
                <div className="text-xs text-slate-400">{t("authPublic.verify.issuedBy", { issuer: cred.issuer })}</div>
              </div>
            </div>

            <div className="mt-6 border-t pt-6">
              <div className="text-xs font-medium uppercase tracking-wide text-[#5391D5]">
                {TYPE_LABEL_KEY[cred.credentialType] ? t(TYPE_LABEL_KEY[cred.credentialType]) : t("authPublic.verify.credentialFallback")}
              </div>
              <h1 className="mt-1 text-2xl font-semibold text-[#010131]">{cred.titleEn}</h1>
              {cred.titleAr && (
                <p dir="rtl" className="mt-1 text-lg text-slate-600">
                  {cred.titleAr}
                </p>
              )}
              {cred.subtitleEn && <p className="mt-2 text-sm text-slate-500">{cred.subtitleEn}</p>}

              <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
                <Field label={t("authPublic.verify.awardedTo")} value={cred.issuedToName} />
                {cred.scorePct != null && <Field label={t("authPublic.verify.score")} value={`${cred.scorePct}%`} />}
                <Field label={t("authPublic.verify.issued")} value={fmtDate(cred.issuedAt) ?? "-"} />
                {cred.expiresAt && (
                  <Field
                    label={expired ? t("authPublic.verify.expired") : t("authPublic.verify.validUntil")}
                    value={fmtDate(cred.expiresAt) ?? "-"}
                  />
                )}
              </dl>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          {t("authPublic.verify.footer")}
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
