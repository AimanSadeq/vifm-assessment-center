import { PsychometricsClient } from "./_components/psychometrics-client";
import { AllServicesLink } from "@/components/shared/all-services-link";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

/**
 * Psychometrics runner (Tier 1 indicative) — cognitive ability + Big-Five
 * personality. Self-served; an admin can bind a result to a candidate/engagement
 * via ?candidateId=…&engagementId=… (mirrors the Fluent runner).
 */
export default function PsychometricsPage({
  searchParams,
}: {
  searchParams?: { candidateId?: string; engagementId?: string };
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/" label="Back" history />
      <div className="mb-4 flex justify-end">
        <AllServicesLink />
      </div>
      <PsychometricsClient
        candidateId={searchParams?.candidateId ?? null}
        engagementId={searchParams?.engagementId ?? null}
      />
    </div>
  );
}
