export const dynamic = "force-dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CandidateDemographicsForm } from "./_components/candidate-demographics-form";
import { ImpersonationBanner } from "@/components/shared/impersonation-banner";
import { getServerT } from "@/lib/i18n/server";
import { BackLink } from "@/components/shared/back-link";
import { LocalDate } from "@/components/shared/local-date";

type Props = {
  params: { candidateId: string };
  searchParams: { asAdmin?: string };
};

export default async function CandidateWelcomePage({ params, searchParams }: Props) {
  const supabase = await createClient();
  const t = await getServerT();
  const { candidateId } = params;

  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("*, engagements(id, name, target_role, start_date, end_date, organizations(name))")
    .eq("id", candidateId)
    .single();

  if (error || !candidate) return notFound();
  const asAdmin = searchParams?.asAdmin === "1";

  const eng = candidate.engagements as unknown as {
    id: string;
    name: string;
    target_role: string | null;
    start_date: string | null;
    end_date: string | null;
    organizations: { name: string };
  };

  // Check consent status
  const { data: consents } = await supabase
    .from("consent_records")
    .select("id")
    .eq("candidate_id", candidateId)
    .limit(1);

  const hasConsented = (consents?.length ?? 0) > 0;

  // The decision made on the assessment, once the participant has been told
  // (BPS 5.9), and any re-assessment arranged for them (BPS 5.50). Both are
  // tolerant of migration 00210 not being applied.
  const reassessments = await supabase
    .from("ac_reassessment_requests")
    .select("id, reason, status, scheduled_for, outcome_note")
    .eq("candidate_id", candidateId)
    .neq("status", "declined")
    .order("created_at", { ascending: false })
    .then(
      (r) => (r.data ?? []) as Record<string, unknown>[],
      () => [] as Record<string, unknown>[]
    );
  // The joining pack comes before consent (BPS 3.17, 5.39): a participant sent
  // straight to a consent form has not been given what they need to consent.
  const { data: packEng } = await supabase
    .from("engagements")
    .select("pack_published_at")
    .eq("id", eng.id)
    .maybeSingle()
    .then((r) => r, () => ({ data: null }));
  const packPublished = Boolean((packEng as { pack_published_at?: string | null } | null)?.pack_published_at);
  const packAcked = Boolean((candidate as { pack_ack_at?: string | null }).pack_ack_at);
  const consentHref = packPublished && !packAcked
    ? `/candidate/pack/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`
    : `/candidate/consent/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`;

  const decisionToldAt = (candidate as { decision_communicated_at?: string | null }).decision_communicated_at ?? null;
  const decisionOutcome = (candidate as { decision_outcome?: string | null }).decision_outcome ?? null;
  const decisionMadeAt = (candidate as { decision_made_at?: string | null }).decision_made_at ?? null;
  const decisionNote = (candidate as { decision_note?: string | null }).decision_note ?? null;

  return (
    <div className="space-y-6">
      <BackLink href="/candidate" label="Back" history />
      {asAdmin && (
        <ImpersonationBanner
          candidateName={candidate.full_name}
          candidateEmail={candidate.email}
          exitHref={`/admin/engagements/${eng.id}`}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {t("candidateWelcome.welcomeTitle", { name: candidate.full_name })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {t("candidateWelcome.intro")}
          </p>

          <Separator />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-muted-foreground">{t("candidateWelcome.assessment")}</div>
            <div className="font-medium">{eng.name}</div>
            <div className="text-muted-foreground">{t("candidateWelcome.organization")}</div>
            <div className="font-medium">{eng.organizations?.name ?? "-"}</div>
            {eng.target_role && (
              <>
                <div className="text-muted-foreground">{t("candidateWelcome.targetRole")}</div>
                <div className="font-medium">{eng.target_role}</div>
              </>
            )}
            <div className="text-muted-foreground">{t("candidateWelcome.dates")}</div>
            <div className="font-medium">
              {eng.start_date ?? t("candidateWelcome.tbd")} - {eng.end_date ?? t("candidateWelcome.tbd")}
            </div>
            <div className="text-muted-foreground">{t("candidateWelcome.status")}</div>
            <div>
              <Badge variant="outline">{t(`candidate.status.${candidate.status}`)}</Badge>
            </div>
          </div>

          <Separator />

          {/* Demographics form */}
          <CandidateDemographicsForm
            candidateId={candidateId}
            initialData={{
              department: candidate.department ?? "",
              gender: candidate.gender ?? "",
              functionRole: candidate.function_role ?? "",
              nationalIdHash: candidate.national_id_hash ?? "",
            }}
          />

          {decisionToldAt && decisionOutcome && (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <div className="font-medium text-foreground">The decision on your assessment</div>
              <p className="mt-1">{decisionOutcome}</p>
              {decisionMadeAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Decided on <LocalDate value={decisionMadeAt} dateOnly />
                </p>
              )}
              {decisionNote && <p className="mt-2 text-muted-foreground">{decisionNote}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                The decision is made by the organisation you were assessed for. If you want to discuss it, use the
                contact on your report, or raise it below.
              </p>
            </div>
          )}

          {reassessments.length > 0 && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
              <div className="font-medium">Re-assessment</div>
              {reassessments.map((r) => (
                <p key={r.id as string} className="mt-1">
                  {r.status === "scheduled" && r.scheduled_for
                    ? <>Arranged for <LocalDate value={r.scheduled_for as string} withTime />.</>
                    : r.status === "completed"
                      ? "Completed."
                      : "Being arranged. Someone will be in touch with a time."}{" "}
                  <span className="text-xs">{r.reason as string}</span>
                </p>
              ))}
            </div>
          )}

          <Separator />

          <div className="flex flex-wrap gap-3">
            {!hasConsented ? (
              <Link href={consentHref}>
                <Button>
                  {packPublished && !packAcked ? "Read this before you take part" : t("candidateWelcome.proceedToConsent")}
                </Button>
              </Link>
            ) : (
              <>
                <Link href={`/candidate/assessments/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`}>
                  <Button>{t("candidateWelcome.viewAssessments")}</Button>
                </Link>
                <Link href={`/candidate/skills/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`}>
                  <Button variant="outline">{t("candidateWelcome.mySkills")}</Button>
                </Link>
                <Link href={`/candidate/academy?candidateId=${candidateId}${asAdmin ? "&asAdmin=1" : ""}`}>
                  <Button variant="outline">{t("candidateWelcome.myLearning")}</Button>
                </Link>
                <Link href={`/candidate/credentials/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`}>
                  <Button variant="outline">{t("candidateWelcome.myCredentials")}</Button>
                </Link>
                <Link href={`/candidate/report/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`}>
                  <Button variant="outline">{t("candidateWelcome.viewReport")}</Button>
                </Link>
              </>
            )}
            {packPublished && (
              <Link href={`/candidate/pack/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`}>
                <Button variant="outline">Before you take part</Button>
              </Link>
            )}
            {/* Available at every stage, not only after consent: the standard
                expects a route before, during and after the centre (BPS 5.44). */}
            <Link href={`/candidate/concerns/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`}>
              <Button variant="outline">Questions or concerns</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
