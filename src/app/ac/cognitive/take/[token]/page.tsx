import { notFound } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getTimerMinutes, TIMER_DEFAULTS } from "@/lib/assessment-timers";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { PsychometricsClient } from "../../_components/psychometrics-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Logica® assessment · VIFM" };

/**
 * Token-gated Cognitive runner for voucher delegates (no account). The
 * redemption token is validated server-side; the completed result is stamped
 * with the voucher's client org by the score route. Public (middleware-bypassed).
 */
export default async function CognitiveTakePage({ params }: { params: { token: string } }) {
  const sb = createServiceClient();
  const { data: redemption } = await sb
    .from("cognitive_voucher_redemptions")
    .select("redemption_token, redeemer_name, voucher_id")
    .eq("redemption_token", params.token)
    .maybeSingle<{ redemption_token: string; redeemer_name: string; voucher_id: string | null }>();
  if (!redemption) return notFound();

  // Voucher subtest scope (00170): lock the delegate to the issued set.
  // Tolerant of the migration not being applied (null = full battery).
  let lockedSubtests: string[] | null = null;
  if (redemption.voucher_id) {
    try {
      const { data: v } = await sb
        .from("cognitive_vouchers")
        .select("subtests")
        .eq("id", redemption.voucher_id)
        .maybeSingle<{ subtests: string[] | null }>();
      lockedSubtests = v?.subtests && v.subtests.length > 0 ? v.subtests : null;
    } catch {
      lockedSubtests = null;
    }
  }

  const timerMinutes = await getTimerMinutes("cognitive", TIMER_DEFAULTS.cognitive);

  return (
    <div className="min-h-screen bg-background">
      <header className="ara-hero relative overflow-hidden">
        {/* Deep enough that the runner's overlapped header (title + subtitle)
            sits entirely on the dark band - see onDark on PsychometricsClient. */}
        <div className="mx-auto max-w-3xl px-6 pt-7 pb-36">
          <VifmLogo variant="white" size="sm" />
          <div className="mt-8 max-w-2xl">
            <span className="ara-eyebrow text-accent">
              <BrainCircuit className="h-3 w-3" /> VIFM Logica®
            </span>
            <h1 className="ara-numeral mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl">
              Welcome{redemption.redeemer_name ? `, ${redemption.redeemer_name}` : ""}
            </h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-32 max-w-3xl px-6 pb-16">
        <PsychometricsClient
          candidateId={null}
          engagementId={null}
          redemptionToken={redemption.redemption_token}
          prefillName={redemption.redeemer_name ?? undefined}
          timerMinutes={timerMinutes}
          lockedSubtests={lockedSubtests}
          onDark
        />
      </main>
    </div>
  );
}
