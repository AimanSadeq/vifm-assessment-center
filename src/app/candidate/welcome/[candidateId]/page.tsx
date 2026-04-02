export const dynamic = "force-dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type Props = { params: { candidateId: string } };

export default async function CandidateWelcomePage({ params }: Props) {
  const supabase = await createClient();
  const { candidateId } = params;

  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("*, engagements(id, name, target_role, start_date, end_date, organizations(name))")
    .eq("id", candidateId)
    .single();

  if (error || !candidate) return notFound();

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
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            Welcome, {candidate.full_name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Welcome to the VIFM Assessment Center. You have been selected to
            participate in an assessment for the role outlined below. This
            process is designed to evaluate your competencies through a series of
            structured exercises.
          </p>

          <Separator />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-muted-foreground">Assessment</div>
            <div className="font-medium">{eng.name}</div>
            <div className="text-muted-foreground">Organization</div>
            <div className="font-medium">{eng.organizations?.name ?? "—"}</div>
            {eng.target_role && (
              <>
                <div className="text-muted-foreground">Target Role</div>
                <div className="font-medium">{eng.target_role}</div>
              </>
            )}
            <div className="text-muted-foreground">Dates</div>
            <div className="font-medium">
              {eng.start_date ?? "TBD"} — {eng.end_date ?? "TBD"}
            </div>
            <div className="text-muted-foreground">Status</div>
            <div>
              <Badge variant="outline">{candidate.status}</Badge>
            </div>
          </div>

          <Separator />

          <div className="flex gap-3">
            {!hasConsented ? (
              <Link href={`/candidate/consent/${candidateId}`}>
                <Button>Proceed to Consent Form</Button>
              </Link>
            ) : (
              <>
                <Link href={`/candidate/assessments/${candidateId}`}>
                  <Button>View Assessments</Button>
                </Link>
                <Link href={`/candidate/report/${candidateId}`}>
                  <Button variant="outline">View Report</Button>
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
