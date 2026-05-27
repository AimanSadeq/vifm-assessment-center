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

  return (
    <div className="space-y-6">
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

          <Separator />

          <div className="flex flex-wrap gap-3">
            {!hasConsented ? (
              <Link href={`/candidate/consent/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`}>
                <Button>{t("candidateWelcome.proceedToConsent")}</Button>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
