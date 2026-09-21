export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/shared/back-link";
import { ImpersonationBanner } from "@/components/shared/impersonation-banner";
import { RaiseConcernForm } from "./_components/raise-concern-form";
import { LocalDate } from "@/components/shared/local-date";
import { loadEngagementContact } from "./actions";

type Props = {
  params: { candidateId: string };
  searchParams: { asAdmin?: string };
};

const STAGE_LABEL: Record<string, string> = {
  before: "Before the centre",
  during: "During the centre",
  after: "After the centre",
};

const STATUS_LABEL: Record<string, string> = {
  open: "With us",
  acknowledged: "Answered",
  resolved: "Closed",
  withdrawn: "Withdrawn",
};

const STATUS_TONE: Record<string, string> = {
  open: "bg-amber-100 text-amber-900",
  acknowledged: "bg-sky-100 text-sky-900",
  resolved: "bg-emerald-100 text-emerald-900",
  withdrawn: "bg-muted text-muted-foreground",
};

export default async function CandidateConcernsPage({ params, searchParams }: Props) {
  const supabase = await createClient();
  const { candidateId } = params;
  const asAdmin = searchParams?.asAdmin === "1";

  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("id, full_name, email, engagement_id")
    .eq("id", candidateId)
    .maybeSingle();
  if (error || !candidate) return notFound();

  // Tolerant of migration 00210 not being applied: the page still renders and
  // the contact details are still shown, which is the part that matters most.
  const raised = await supabase
    .from("ac_participant_concerns")
    .select("id, kind, stage, body, status, response, raised_at, resolved_at, responded_by_name")
    .eq("candidate_id", candidateId)
    .order("raised_at", { ascending: false })
    .then(
      (r) => (r.data ?? []) as Record<string, unknown>[],
      () => [] as Record<string, unknown>[]
    );

  const contact = await loadEngagementContact(candidate.engagement_id as string);

  return (
    <div className="space-y-6">
      {asAdmin && (
        <ImpersonationBanner
          candidateName={candidate.full_name as string}
          candidateEmail={candidate.email as string}
          exitHref={`/admin/engagements/${candidate.engagement_id as string}`}
        />
      )}
      <BackLink href={`/candidate/welcome/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`} label="Back" />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Questions, concerns and appeals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            If something about your assessment did not feel right, you can say so - before it, during it, or after
            your results. Raising a concern does not affect your results, and you can appeal against a result you
            believe is wrong.
          </p>
          {contact?.participant_contact_name || contact?.participant_contact_email ? (
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="font-medium text-foreground">Who you can speak to</div>
              <div className="mt-1 text-muted-foreground">
                {(contact.participant_contact_name as string) ?? "Your assessment contact"}
                {contact.participant_contact_email ? (
                  <>
                    {" - "}
                    <a className="text-accent hover:underline" href={`mailto:${contact.participant_contact_email as string}`}>
                      {contact.participant_contact_email as string}
                    </a>
                  </>
                ) : null}
              </div>
              {contact.appeals_note ? (
                <p className="mt-2 text-xs text-muted-foreground">{contact.appeals_note as string}</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <RaiseConcernForm candidateId={candidateId} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">What you have raised</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {raised.length === 0 ? (
            <p className="text-muted-foreground">You have not raised anything.</p>
          ) : (
            raised.map((r) => (
              <div key={r.id as string} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{r.kind === "appeal" ? "Appeal" : "Concern"}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_TONE[r.status as string] ?? "bg-muted"}`}>
                    {STATUS_LABEL[r.status as string] ?? (r.status as string)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {STAGE_LABEL[r.stage as string] ?? (r.stage as string)} ·{" "}
                    <LocalDate value={r.raised_at as string} withTime />
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap">{r.body as string}</p>
                {r.response ? (
                  <div className="mt-3 rounded border-s-2 border-accent bg-muted/40 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Our answer{r.responded_by_name ? ` · ${r.responded_by_name as string}` : ""}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{r.response as string}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    This is with us. You will be told when there is an answer.
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
