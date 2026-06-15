import { BackLink } from "@/components/shared/back-link";
import { AllServicesLink } from "@/components/shared/all-services-link";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { PersonaStandaloneClient } from "./_components/persona-standalone-client";

export const dynamic = "force-dynamic";

/**
 * Persona - standalone (anonymous) Behavioural Competency Self-Assessment.
 * The name-only "Begin Persona assessment" entry, mirroring the Cognitive
 * runner. Produces a self-profile; it does not feed Succession Readiness (that
 * needs the candidate-bound path at /candidate/behavioral/[id]).
 */
export default function PersonaPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/ac/psychometrics" label="Back" history />
      <div className="mb-4 flex justify-end">
        <AllServicesLink />
      </div>
      <PersonaStandaloneClient competencies={BEHAVIORAL_COMPETENCIES} />
    </div>
  );
}
