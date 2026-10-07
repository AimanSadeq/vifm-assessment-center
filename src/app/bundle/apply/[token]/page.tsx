import { notFound } from "next/navigation";
import { findBundleCandidateByToken, bundleStageState } from "@/lib/bespoke/candidates";
import { bundleLogicaMinutes } from "@/lib/bespoke/sitting";
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

  if (ctx.held) {
    return (
      <div className="min-h-screen bg-[#FEFFF9] px-6 py-16">
        <div className="mx-auto max-w-md rounded-xl border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold text-[#010131]">This assessment is not open yet</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your organisation will let you know when it opens. Please use the same link then.</p>
        </div>
      </div>
    );
  }

  const state = await bundleStageState(ctx);
  const timerMinutes = ctx.stages.includes("logica") ? await bundleLogicaMinutes(ctx) : null;

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
      welcomeMessage={ctx.settings.welcomeMessage}
      demographicFields={ctx.settings.demographicFields}
    />
  );
}
