import Link from "next/link";
import { Ticket, Users, FileClock, ClipboardList } from "lucide-react";
import { BackLink } from "@/components/shared/back-link";
import { AllServicesLink } from "@/components/shared/all-services-link";
import { DesignTargetRolesLink } from "@/components/shared/design-target-roles-link";
import { loadPersonaCompetencies } from "@/lib/persona/bank";
import { loadPersonaRoleOptions } from "@/lib/scoring/persona-roles";
import { loadCompetencyDefinitions } from "@/lib/scoring/competency-definitions";
import { PersonaStandaloneClient } from "./_components/persona-standalone-client";

export const dynamic = "force-dynamic";

/**
 * Persona - standalone (anonymous) Behavioural Competency Self-Assessment.
 * The name-only "Begin Persona assessment" entry, mirroring the Cognitive
 * runner. Produces a self-profile; it does not feed Succession Readiness (that
 * needs the candidate-bound path at /candidate/behavioral/[id]).
 */
export default async function PersonaPage({ searchParams }: { searchParams?: { demo?: string; purpose?: string } }) {
  const [roleProfiles, definitions, competencies] = await Promise.all([
    loadPersonaRoleOptions(),
    loadCompetencyDefinitions(),
    loadPersonaCompetencies(),
  ]);
  // Demo shortcut button: shown with ?demo=1 (live client demos) or in dev.
  const demo = searchParams?.demo === "1" || process.env.NODE_ENV !== "production";
  // CAL-PER-402: when entered from a landing tile the purpose is locked -
  // Talent Acquisition -> hiring, Talent Management -> development. The runner
  // then hides the purpose picker. A bare /ac/persona (admin) keeps the picker.
  const lockedPurpose: "hiring" | "development" | null =
    searchParams?.purpose === "hiring" ? "hiring" : searchParams?.purpose === "development" ? "development" : null;
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/" label="Back" history />
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/ac/persona/results"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          <ClipboardList className="h-3.5 w-3.5" /> Results
        </Link>
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
        <DesignTargetRolesLink />
        <AllServicesLink />
      </div>
      <PersonaStandaloneClient competencies={competencies} roleProfiles={roleProfiles} definitions={definitions} demo={demo} lockedPurpose={lockedPurpose} />
    </div>
  );
}
