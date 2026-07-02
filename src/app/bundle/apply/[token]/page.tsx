import { notFound } from "next/navigation";
import { findBundleCandidateByToken, bundleStageState } from "@/lib/bespoke/candidates";
import { getTimerMinutes, TIMER_DEFAULTS } from "@/lib/assessment-timers";
import { COGNITIVE_SUBTESTS, COGNITIVE_SUBTEST_KEYS } from "@/lib/psychometrics/framework";
import { BundleFlow } from "./_components/bundle-flow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bespoke assessment · VIFM" };

/**
 * Token-gated one-sitting flow for a composed bespoke bundle (no account):
 * consent -> each runnable service in composed order (Persona, Logica) -> done.
 * Public (middleware-bypassed); the token is validated server-side.
 */
export default async function BundleApplyPage({ params }: { params: { token: string } }) {
  const ctx = await findBundleCandidateByToken(params.token);
  if (!ctx || ctx.stages.length === 0) return notFound();

  const state = await bundleStageState(ctx);
  const timerMinutes = ctx.stages.includes("logica")
    ? await getTimerMinutes("cognitive", TIMER_DEFAULTS.cognitive)
    : null;

  const scope = ctx.logicaSubtests ?? [...COGNITIVE_SUBTEST_KEYS];
  const logicaLabel =
    scope.length === COGNITIVE_SUBTEST_KEYS.length
      ? "Numerical, verbal, inductive and deductive reasoning"
      : scope.map((k) => COGNITIVE_SUBTESTS.find((s) => s.key === k)?.name_en ?? k).join(" · ");

  return (
    <BundleFlow
      token={params.token}
      candidateName={ctx.candidate.full_name}
      bundleName={ctx.bundle.name_en}
      stages={ctx.stages}
      hasConsent={!!ctx.candidate.consent_at}
      personaDone={state.personaDone}
      cognitiveDone={state.cognitiveDone}
      timerMinutes={timerMinutes}
      logicaLabel={logicaLabel}
    />
  );
}
