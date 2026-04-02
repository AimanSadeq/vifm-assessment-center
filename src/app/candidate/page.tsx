export const dynamic = "force-dynamic";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { ProcessMap, type ProcessStep } from "@/components/shared/process-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function CandidateDashboardPage() {
  const supabase = createServiceClient();

  const [candR, consentR, assignR, reportR] = await Promise.all([
    supabase.from("candidates").select("id, full_name, status, engagement_id, engagements(name, organizations(name))").order("full_name"),
    supabase.from("consent_records").select("id"),
    supabase.from("assessor_assignments").select("id"),
    supabase.from("candidate_reports").select("id, status"),
  ]);

  const candidates = candR.data ?? [];
  const consents = consentR.data?.length ?? 0;
  const assigns = assignR.data?.length ?? 0;
  const released = reportR.data?.filter((r) => r.status === "released").length ?? 0;

  // If there are candidates, show the process map with first candidate's links
  // Plus a candidate selector below
  const firstId = candidates[0]?.id ?? "";

  const steps: ProcessStep[] = [
    { id: "welcome", number: 1, title: "Welcome & Profile", href: firstId ? `/candidate/welcome/${firstId}` : "/candidate", iconName: "HandHeart", metric: candidates.length, metricLabel: "candidates", isComplete: candidates.length > 0, isActive: candidates.length === 0 },
    { id: "consent", number: 2, title: "Consent & Privacy", href: firstId ? `/candidate/consent/${firstId}` : "/candidate", iconName: "ShieldCheck", metric: consents, metricLabel: "consents", isComplete: consents > 0, isActive: candidates.length > 0 && consents === 0 },
    { id: "assessments", number: 3, title: "Complete Assessments", href: firstId ? `/candidate/assessments/${firstId}` : "/candidate", iconName: "ClipboardList", metric: assigns, metricLabel: "exercises", isComplete: assigns > 0, isActive: consents > 0 && assigns === 0 },
    { id: "report", number: 4, title: "View Report", href: firstId ? `/candidate/report/${firstId}` : "/candidate", iconName: "FileText", metric: released, metricLabel: "reports", isComplete: released > 0, isActive: assigns > 0 && released === 0 },
  ];

  return (
    <div className="space-y-8">
      <ProcessMap
        title="Your Assessment Journey"
        subtitle="Follow the steps below to complete your assessment center experience."
        steps={steps}
        completedCount={steps.filter((s) => s.isComplete).length}
        totalSteps={steps.length}
      />

      {/* Candidate selector — dev mode only, hidden in production */}
      {process.env.NODE_ENV === "development" && candidates.length > 1 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Select Your Profile</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {candidates.map((c) => {
              const eng = c.engagements as unknown as { name: string; organizations: { name: string } } | null;
              return (
                <Link key={c.id} href={`/candidate/welcome/${c.id}`}>
                  <Card className="hover:border-accent/50 transition-colors cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{c.full_name}</CardTitle>
                        <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">{eng?.name ?? "—"}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
