export const dynamic = "force-dynamic";

/**
 * The master checklists themselves, for reading the process end to end or
 * briefing someone new, without any engagement attached.
 */

import { requireRole } from "@/lib/ara/auth-guards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/shared/back-link";
import { CHECKLISTS } from "@/lib/checklists/definitions";
import { OWNER_LABEL, PHASES, PHASE_LABEL } from "@/lib/checklists/types";

export default async function MasterChecklistsPage() {
  await requireRole(["admin"]);
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <BackLink href="/admin/checklists" label="Back to engagement checklists" />
      <div>
        <h1 className="text-2xl font-bold">The master checklists</h1>
        <p className="text-sm text-muted-foreground">
          One per service, from the first conversation to close. Items marked &quot;record&quot; tick themselves from the platform on each engagement.
        </p>
      </div>
      {Object.values(CHECKLISTS).map((def) => (
        <Card key={def.service}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{def.serviceLabel}</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            {PHASES.map((phase) => {
              const items = def.items.filter((i) => i.phase === phase);
              if (!items.length) return null;
              return (
                <section key={phase}>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{PHASE_LABEL[phase]}</h3>
                  <ol className="list-decimal space-y-1 ps-5">
                    {items.map((it) => (
                      <li key={it.key}>
                        {it.label}
                        <span className="ms-2 text-xs text-muted-foreground">{OWNER_LABEL[it.owner]}{it.auto ? " · record" : ""}{it.when ? " · when applicable" : ""}</span>
                        {it.hint && <div className="text-xs text-muted-foreground">{it.hint}</div>}
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
