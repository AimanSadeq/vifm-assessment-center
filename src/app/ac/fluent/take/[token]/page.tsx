import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { usableIdentity } from "@/lib/privacy/purged";
import { getTimerMinutes, TIMER_DEFAULTS } from "@/lib/assessment-timers";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { FluentClient } from "../../_components/fluent-client";
import { FluentLanguageProvider, FluentTakeHeader } from "../../_components/fluent-language";
import { ProctorCapture } from "@/components/proctor/proctor-capture";

export const dynamic = "force-dynamic";
export const metadata = { title: "English placement · VIFM Fluent®" };

/**
 * Token-gated Fluent runner for voucher delegates (no account). The redemption
 * token is validated server-side; the completed result is stamped with the
 * voucher's client org (via the score route). Public (middleware-bypassed).
 */
export default async function FluentTakePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { proctor?: string };
}) {
  const sb = createServiceClient();
  const { data: redemption } = await sb
    .from("eng_fluent_voucher_redemptions")
    .select("redemption_token, redeemer_name, redeemer_email, voucher_id, result_id")
    .eq("redemption_token", params.token)
    .maybeSingle<{ redemption_token: string; redeemer_name: string; redeemer_email: string; voucher_id: string; result_id: string | null }>();
  if (!redemption) return notFound();

  // An anonymised redemption holds "[purged]" in these columns (the retention
  // purge filters on redeemed_at, not on whether the sitting was completed, so
  // an old unused token stays live). Resolve once: never greet a delegate with
  // it, never prefill it, never stamp it onto a proctoring record.
  const displayName = usableIdentity(redemption.redeemer_name);
  const displayEmail = usableIdentity(redemption.redeemer_email);

  // One seat = one placement. Once this token has a completed sitting, refuse a
  // retake (the score route enforces the same on its side) so a delegate cannot
  // re-sit and self-select their best CEFR from a single voucher.
  if (redemption.result_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <VifmLogo variant="dark" size="sm" className="mx-auto" />
          <h1 className="mt-6 text-xl font-semibold text-primary">Assessment already completed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This placement has already been submitted{displayName ? `, ${displayName}` : ""}.
            Your result has been recorded and sent to the organisation that invited you. This link can be used once.
          </p>
        </div>
      </div>
    );
  }

  // Proctoring is enforced server-side, in precedence order (integrity pass):
  // 1. the client org's policy (organizations.settings.fluent_proctoring_required,
  //    migration 00173) - a client mandate covers every voucher, old and new;
  // 2. the per-voucher flag (migration 00149);
  // 3. the ?proctor=1 URL param (admin-run path only - auxiliary, never the gate).
  // The taker can strip the URL param but cannot touch 1 or 2 (both fetched
  // server-side). Tolerant of un-applied migrations (defaults to off).
  let proctorRequired = false;
  try {
    const { data: voucher } = await sb
      .from("eng_fluent_vouchers")
      .select("proctor_enabled, organization_id")
      .eq("id", redemption.voucher_id)
      .maybeSingle<{ proctor_enabled: boolean; organization_id: string | null }>();
    proctorRequired = voucher?.proctor_enabled ?? false;
    if (!proctorRequired && voucher?.organization_id) {
      const { getOrgSettings } = await import("@/lib/clients/org-settings");
      const settings = await getOrgSettings(voucher.organization_id);
      proctorRequired = settings.fluent_proctoring_required === true;
    }
  } catch {
    /* 00149/00173 not applied yet - proctoring stays off */
  }

  const fluentMinutes = (await getTimerMinutes("fluent", TIMER_DEFAULTS.fluent)) ?? TIMER_DEFAULTS.fluent;

  return (
    <div className="min-h-screen bg-background">
      {/* The header and the runner share one language state, so the welcome
          follows the test-language selector inside the card below it (and
          flips to RTL for Arabic). */}
      <FluentLanguageProvider>
        <header className="fluent-hero">
          <div className="mx-auto max-w-5xl px-6 pt-7 pb-20">
            <VifmLogo variant="white" size="sm" />
            <FluentTakeHeader name={displayName} />
          </div>
        </header>

        <main className="relative z-10 mx-auto -mt-10 max-w-5xl px-6 pb-16">
          <ProctorCapture
            enabled={proctorRequired || searchParams?.proctor === "1"}
            context="fluent"
            refId={redemption.redemption_token}
            subjectName={displayName ?? null}
            subjectEmail={displayEmail ?? null}
          />
          <FluentClient
            redemptionToken={redemption.redemption_token}
            prefillName={displayName}
            prefillEmail={displayEmail}
            timerMinutes={fluentMinutes}
            resultsShownToTaker={false}
          />
        </main>
      </FluentLanguageProvider>
    </div>
  );
}
