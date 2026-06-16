import Link from "next/link";
import { Ticket, Users, FileClock } from "lucide-react";
import { PsychometricsClient, type EngagementOption } from "./_components/psychometrics-client";
import { AllServicesLink } from "@/components/shared/all-services-link";
import { BackLink } from "@/components/shared/back-link";
import { createServiceClient } from "@/lib/supabase/server";
import { getTimerMinutes, TIMER_DEFAULTS } from "@/lib/assessment-timers";

export const dynamic = "force-dynamic";

/** Engagements (with their candidates) for the optional candidate binding. */
async function loadEngagementOptions(): Promise<EngagementOption[]> {
  try {
    const sb = createServiceClient();
    const [{ data: engs }, { data: cands }] = await Promise.all([
      sb.from("engagements").select("id, name, created_at").order("created_at", { ascending: false }),
      sb.from("candidates").select("id, full_name, engagement_id"),
    ]);
    const byEng = new Map<string, { id: string; full_name: string }[]>();
    for (const c of cands ?? []) {
      const eid = c.engagement_id as string;
      if (!byEng.has(eid)) byEng.set(eid, []);
      byEng.get(eid)!.push({ id: c.id as string, full_name: (c.full_name as string) ?? "—" });
    }
    return (engs ?? [])
      .map((e) => ({ id: e.id as string, name: (e.name as string) ?? "—", candidates: byEng.get(e.id as string) ?? [] }))
      .filter((e) => e.candidates.length > 0);
  } catch {
    return [];
  }
}

/**
 * Cognitive Ability runner (Tier 1 indicative) — numerical / verbal / inductive /
 * deductive reasoning. A standalone service. Self-served; an admin can bind a result to a
 * candidate/engagement via ?candidateId=…&engagementId=… (mirrors Fluent) or the
 * inline picker.
 */
export default async function CognitivePage({
  searchParams,
}: {
  searchParams?: { candidateId?: string; engagementId?: string };
}) {
  const engagements = await loadEngagementOptions();
  const timerMinutes = await getTimerMinutes("cognitive", TIMER_DEFAULTS.cognitive);
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <BackLink href="/" label="Back" history />
      <div className="mb-4 flex items-center justify-end gap-2">
        <Link
          href="/ac/cognitive/cohort"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          <Users className="h-3.5 w-3.5" /> Cohort
        </Link>
        <Link
          href="/ac/cognitive/vouchers"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          <Ticket className="h-3.5 w-3.5" /> Vouchers
        </Link>
        <Link
          href="/ac/cognitive/retention"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          <FileClock className="h-3.5 w-3.5" /> Retention
        </Link>
        <AllServicesLink />
      </div>
      <PsychometricsClient
        candidateId={searchParams?.candidateId ?? null}
        engagementId={searchParams?.engagementId ?? null}
        engagements={engagements}
        timerMinutes={timerMinutes}
      />
    </div>
  );
}
