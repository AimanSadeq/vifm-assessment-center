export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/shared/back-link";
import { ImpersonationBanner } from "@/components/shared/impersonation-banner";
import { LocalDate } from "@/components/shared/local-date";
import { buildJoiningPack, type PackEngagement, type PackExercise } from "@/lib/ac/joining-pack";
import { PackAcknowledgement } from "./_components/pack-acknowledgement";
import { AdjustmentRequest } from "./_components/adjustment-request";
import { VoluntaryDemographics } from "./_components/voluntary-demographics";

type Props = {
  params: { candidateId: string };
  searchParams: { asAdmin?: string };
};

export default async function JoiningPackPage({ params, searchParams }: Props) {
  const supabase = await createClient();
  const { candidateId } = params;
  const asAdmin = searchParams?.asAdmin === "1";

  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("id, full_name, email, engagement_id, pack_ack_at, adjustment_status, adjustment_request, adjustment_agreed, adjustment_extra_minutes, gender, age_band, nationality_group, demographics_submitted_at")
    .eq("id", candidateId)
    .maybeSingle();
  if (error || !candidate) return notFound();

  // The pack lives on the engagement, which a participant cannot read directly,
  // so it is fetched with the service client - scoped to the one engagement the
  // caller has already proved they can see through their own candidate row.
  const sb = createServiceClient();
  const [{ data: eng }, { data: exRows }] = await Promise.all([
    sb.from("engagements").select("*, organizations(name)").eq("id", candidate.engagement_id as string).maybeSingle(),
    sb
      .from("engagement_exercises")
      .select("exercises(name, exercise_type, duration_minutes)")
      .eq("engagement_id", candidate.engagement_id as string),
  ]);
  if (!eng) return notFound();

  const exercises = (exRows ?? [])
    .map((r) => r.exercises as unknown as PackExercise | null)
    .filter(Boolean) as PackExercise[];
  const pack = buildJoiningPack(eng as PackEngagement, exercises);
  const ackAt = candidate.pack_ack_at as string | null;

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
          <CardTitle className="text-xl">Before you take part</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            {pack.organisationName
              ? `${pack.title}, for ${pack.organisationName}.`
              : pack.title}
          </p>
          <p className="text-muted-foreground">
            Please read this before you agree to take part. It explains what the assessment is for, what you will be
            asked to do, who sees the results and how long they are kept.
          </p>
          {!pack.published && (
            <p className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
              This pack is still being prepared, so some of it may change before the centre runs.
            </p>
          )}
        </CardContent>
      </Card>

      {pack.sections.map((s) => (
        <Card key={s.heading}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{s.heading}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="whitespace-pre-wrap leading-relaxed">{s.body}</p>
          </CardContent>
        </Card>
      ))}

      <AdjustmentRequest
        candidateId={candidateId}
        status={(candidate.adjustment_status as string) ?? "not_asked"}
        request={(candidate.adjustment_request as string) ?? ""}
        agreed={(candidate.adjustment_agreed as string) ?? ""}
        extraMinutes={(candidate.adjustment_extra_minutes as number) ?? null}
      />

      <VoluntaryDemographics
        candidateId={candidateId}
        gender={(candidate.gender as string) ?? ""}
        ageBand={(candidate.age_band as string) ?? ""}
        nationalityGroup={(candidate.nationality_group as string) ?? ""}
        submittedAt={(candidate.demographics_submitted_at as string) ?? null}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Confirming you have read this</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {ackAt ? (
            <>
              <p className="text-muted-foreground">
                You confirmed you had read this on <LocalDate value={ackAt} withTime />.
              </p>
              <Link href={`/candidate/consent/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`}>
                <Button>Continue to consent</Button>
              </Link>
            </>
          ) : (
            <PackAcknowledgement candidateId={candidateId} asAdmin={asAdmin} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
