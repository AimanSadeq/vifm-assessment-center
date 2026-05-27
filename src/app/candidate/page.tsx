export const dynamic = "force-dynamic";
import Link from "next/link";
import { Sparkles, HandHeart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { ProcessMap, type ProcessStep } from "@/components/shared/process-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function CandidateDashboardPage() {
  const supabase = await createClient();
  const t = await getServerT();

  const [candR, consentR, exR, reportR] = await Promise.all([
    supabase.from("candidates").select("id, full_name, status, engagement_id, engagements(name, organizations(name))").order("full_name"),
    supabase.from("consent_records").select("id"),
    supabase.from("engagement_exercises").select("id"),
    supabase.from("candidate_reports").select("id, status"),
  ]);

  const candidates = candR.data ?? [];
  const consents = consentR.data?.length ?? 0;
  const exercises = exR.data?.length ?? 0;
  const released = reportR.data?.filter((r) => r.status === "released").length ?? 0;

  // If there are candidates, show the process map with first candidate's links
  // Plus a candidate selector below
  const firstId = candidates[0]?.id ?? "";

  const steps: ProcessStep[] = [
    { id: "welcome", number: 1, title: t("candidateHome.steps.welcome"), href: firstId ? `/candidate/welcome/${firstId}` : "/candidate", iconName: "HandHeart", metric: candidates.length, metricLabel: t("candidateHome.metrics.candidates"), isComplete: candidates.length > 0, isActive: candidates.length === 0 },
    { id: "consent", number: 2, title: t("candidateHome.steps.consent"), href: firstId ? `/candidate/consent/${firstId}` : "/candidate", iconName: "ShieldCheck", metric: consents, metricLabel: t("candidateHome.metrics.consents"), isComplete: consents > 0, isActive: candidates.length > 0 && consents === 0 },
    { id: "assessments", number: 3, title: t("candidateHome.steps.assessments"), href: firstId ? `/candidate/assessments/${firstId}` : "/candidate", iconName: "ClipboardList", metric: exercises, metricLabel: t("candidateHome.metrics.exercises"), isComplete: exercises > 0, isActive: consents > 0 && exercises === 0 },
    { id: "report", number: 4, title: t("candidateHome.steps.report"), href: firstId ? `/candidate/report/${firstId}` : "/candidate", iconName: "FileText", metric: released, metricLabel: t("candidateHome.metrics.reports"), isComplete: released > 0, isActive: exercises > 0 && released === 0 },
  ];

  return (
    <div className="space-y-6">
      <section className="ara-hero relative overflow-hidden rounded-2xl">
        <div className="px-6 py-8 sm:px-8 sm:py-10 relative z-10">
          <span className="ara-eyebrow text-accent">
            <Sparkles className="h-3 w-3" />
            {t("candidateHome.eyebrow")}
          </span>
          <h1 className="ara-numeral text-2xl sm:text-3xl font-semibold text-white leading-[1.1] mt-3 mb-3 max-w-2xl">
            {t("candidateHome.title")}
          </h1>
          <p className="text-sm text-white/75 max-w-2xl">
            {t("candidateHome.intro")}
          </p>
          <div className="flex flex-wrap items-center gap-2.5 mt-5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white px-3.5 py-1.5 rounded-full border border-white/25 bg-white/10 backdrop-blur">
              <HandHeart className="h-3.5 w-3.5" />
              {t("candidateHome.stepsComplete", {
                done: steps.filter((s) => s.isComplete).length,
                total: steps.length,
              })}
            </span>
          </div>
        </div>
      </section>

      <ProcessMap
        title={t("candidateHome.title")}
        subtitle={t("candidateHome.mapSubtitle")}
        steps={steps}
        completedCount={steps.filter((s) => s.isComplete).length}
        totalSteps={steps.length}
      />

      {/* Candidate selector - dev mode only, hidden in production */}
      {process.env.NODE_ENV === "development" && candidates.length > 1 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">{t("candidateHome.selectProfile")}</h2>
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
                      <p className="text-xs text-muted-foreground">{eng?.name ?? "-"}</p>
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
