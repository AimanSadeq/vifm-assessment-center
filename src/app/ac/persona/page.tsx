import Link from "next/link";
import { Ticket, Users, FileClock } from "lucide-react";
import { BackLink } from "@/components/shared/back-link";
import { AllServicesLink } from "@/components/shared/all-services-link";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { loadPersonaRoleOptions } from "@/lib/scoring/persona-roles";
import { PersonaStandaloneClient } from "./_components/persona-standalone-client";

export const dynamic = "force-dynamic";

/**
 * Persona - standalone (anonymous) Behavioural Competency Self-Assessment.
 * The name-only "Begin Persona assessment" entry, mirroring the Cognitive
 * runner. Produces a self-profile; it does not feed Succession Readiness (that
 * needs the candidate-bound path at /candidate/behavioral/[id]).
 */
export default async function PersonaPage() {
  const roleProfiles = await loadPersonaRoleOptions();
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/" label="Back" history />
      <div className="mb-4 flex items-center justify-end gap-2">
        <Link
          href="/ac/persona/cohort"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          <Users className="h-3.5 w-3.5" /> Cohort
        </Link>
        <Link
          href="/ac/persona/vouchers"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          <Ticket className="h-3.5 w-3.5" /> Vouchers
        </Link>
        <Link
          href="/ac/persona/retention"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          <FileClock className="h-3.5 w-3.5" /> Retention
        </Link>
        <AllServicesLink />
      </div>
      <PersonaStandaloneClient competencies={BEHAVIORAL_COMPETENCIES} roleProfiles={roleProfiles} />
    </div>
  );
}
