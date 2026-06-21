import { notFound } from "next/navigation";
import { Languages } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getTimerMinutes, TIMER_DEFAULTS } from "@/lib/assessment-timers";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { FluentClient } from "../../_components/fluent-client";
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
    .select("redemption_token, redeemer_name, redeemer_email, voucher_id")
    .eq("redemption_token", params.token)
    .maybeSingle<{ redemption_token: string; redeemer_name: string; redeemer_email: string; voucher_id: string }>();
  if (!redemption) return notFound();

  // Proctoring is enforced per-voucher (migration 00149): if the redeemed
  // voucher requires it, the camera turns on regardless of any URL flag. The
  // ?proctor=1 param still works for the admin-run path. Tolerant of an
  // un-applied 00149 (defaults to off).
  let proctorRequired = false;
  try {
    const { data: voucher } = await sb
      .from("eng_fluent_vouchers")
      .select("proctor_enabled")
      .eq("id", redemption.voucher_id)
      .maybeSingle<{ proctor_enabled: boolean }>();
    proctorRequired = voucher?.proctor_enabled ?? false;
  } catch {
    /* 00149 not applied yet - proctoring stays off */
  }

  const fluentMinutes = (await getTimerMinutes("fluent", TIMER_DEFAULTS.fluent)) ?? TIMER_DEFAULTS.fluent;

  return (
    <div className="min-h-screen bg-background">
      <header className="fluent-hero">
        <div className="mx-auto max-w-5xl px-6 pt-7 pb-20">
          <VifmLogo variant="white" size="sm" />
          <div className="mt-8 max-w-2xl">
            <span className="ara-eyebrow text-[#9CC4EC]">
              <Languages className="h-3 w-3" /> VIFM Fluent® · English placement
            </span>
            <h1 className="ara-numeral mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Welcome{redemption.redeemer_name ? `, ${redemption.redeemer_name}` : ""}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-white/75">
              A four-skill, CEFR-aligned English placement. Reading and listening are
              auto-scored; writing and speaking are scored against the CEFR rubric.
            </p>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-10 max-w-5xl px-6 pb-16">
        <ProctorCapture
          enabled={proctorRequired || searchParams?.proctor === "1"}
          context="fluent"
          refId={redemption.redemption_token}
          subjectName={redemption.redeemer_name ?? null}
          subjectEmail={redemption.redeemer_email ?? null}
        />
        <FluentClient
          redemptionToken={redemption.redemption_token}
          prefillName={redemption.redeemer_name ?? undefined}
          prefillEmail={redemption.redeemer_email ?? undefined}
          timerMinutes={fluentMinutes}
        />
      </main>
    </div>
  );
}
