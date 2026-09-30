export const dynamic = "force-dynamic";

/**
 * One engagement's checklist on its own page. The home of the checklist for
 * the voucher-based services (Persona, Logica, Fluent, Techno), which have no
 * engagement page to carry a panel; a full-size view for the rest.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { ServiceChecklist } from "@/components/shared/service-checklist";
import { CHECKLISTS, isChecklistService } from "@/lib/checklists/definitions";
import { canManageChecklist, loadChecklist } from "@/lib/checklists/load";

export default async function ChecklistSubjectPage({ params }: { params: { service: string; id: string } }) {
  const caller = await getCurrentCaller();
  if (!caller || !isChecklistService(params.service)) notFound();
  const service = params.service;
  const loaded = await loadChecklist(createServiceClient(), service, params.id);
  if (!loaded || !canManageChecklist(caller, service, loaded.subject)) notFound();
  const { subject, status } = loaded;
  const ownPage = !subject.href.startsWith("/admin/checklists/");

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-6 py-8">
      <BackLink href="/admin/checklists" label="Back to engagement checklists" />
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{CHECKLISTS[service].serviceLabel}</div>
        <h1 className="text-2xl font-bold">{subject.name}</h1>
        <p className="text-sm text-muted-foreground">
          {[subject.organisationName, subject.status].filter(Boolean).join(" · ")}
          {ownPage && (
            <>
              {" · "}
              <Link className="text-accent hover:underline" href={subject.href}>Open the engagement</Link>
            </>
          )}
        </p>
      </div>
      <ServiceChecklist service={service} subjectId={subject.id} status={status} serviceLabel={CHECKLISTS[service].serviceLabel} canTick />
    </div>
  );
}
