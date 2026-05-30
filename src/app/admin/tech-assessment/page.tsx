export const dynamic = "force-dynamic";

import Link from "next/link";
import { SquarePen, ListChecks, BadgeCheck, ShieldCheck, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProcessMap, type ProcessStep } from "@/components/shared/process-map";
import { getTechPipelineStats } from "@/lib/competencies/technical-item-bank";

const ITEMS_HREF = "/admin/tech-assessment/items";
const RUNNER_HREF = "/ac/tech-assessment";

export default async function TechAssessmentCommandPage() {
  const s = await getTechPipelineStats();

  // The certification pipeline as a continuous cycle (mirrors the AC command
  // cycle, but the stages are the build→certify→issue lifecycle, not a
  // candidate journey). "Complete" = the stage has any progress; the first
  // incomplete stage is the active next action.
  const raw: Omit<ProcessStep, "isActive">[] = [
    { id: "bank", number: 1, title: "Item bank", href: `${ITEMS_HREF}#draft`, iconName: "FileStack", metric: s.itemsTotal, metricLabel: "items drafted", isComplete: s.itemsTotal > 0 },
    { id: "review", number: 2, title: "SME review", href: `${ITEMS_HREF}#items`, iconName: "UserCheck", metric: s.itemsApproved, metricLabel: "approved", isComplete: s.itemsApproved > 0 },
    { id: "cutscores", number: 3, title: "Cut-scores", href: `${ITEMS_HREF}#cutscores`, iconName: "Award", metric: s.domainsWithCutScore, metricLabel: "domains set", isComplete: s.domainsWithCutScore > 0 },
    { id: "certifiable", number: 4, title: "Certifiable", href: `${ITEMS_HREF}#readiness`, iconName: "Star", metric: s.domainsCertifiable, metricLabel: `of ${s.totalDomains} domains`, isComplete: s.domainsCertifiable > 0 },
    { id: "assessed", number: 5, title: "Assessed", href: RUNNER_HREF, iconName: "Users", metric: s.resultsTotal, metricLabel: "assessments", isComplete: s.resultsTotal > 0 },
    { id: "credentials", number: 6, title: "Credentials", href: ITEMS_HREF, iconName: "ShieldCheck", metric: s.credentialsIssued, metricLabel: "issued", isComplete: s.credentialsIssued > 0 },
  ];
  const activeIdx = raw.findIndex((x) => !x.isComplete);
  const steps: ProcessStep[] = raw.map((x, i) => ({ ...x, isActive: i === activeIdx }));
  const completedCount = steps.filter((x) => x.isComplete).length;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="rounded-2xl border bg-gradient-to-r from-[#4c0519] to-[#881337] text-white overflow-hidden">
        <div className="px-6 py-8 sm:px-8 sm:py-10">
          <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-rose-100/80">
            <BadgeCheck className="h-3.5 w-3.5" /> Technical Certification
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold leading-tight mt-3 mb-2">Technical Assessment Command</h1>
          <p className="text-sm text-rose-50/85 max-w-2xl">
            Track the certification pipeline across every domain — from item bank to issued credentials. A
            domain certifies only once its bank is SME-approved and a cut-score is set.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 mt-5">
            <Link
              href={RUNNER_HREF}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white px-3.5 py-1.5 rounded-full border border-white/25 bg-white/10 hover:bg-white/15 hover:border-white/40 transition-colors"
            >
              <SquarePen className="h-3.5 w-3.5" /> Take assessment
            </Link>
            <Link
              href={ITEMS_HREF}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white/85 px-3.5 py-1.5 rounded-full border border-white/15 bg-white/0 hover:bg-white/10 hover:border-white/30 transition-colors"
            >
              <ListChecks className="h-3.5 w-3.5" /> Item review
            </Link>
          </div>
        </div>
      </section>

      <ProcessMap
        title="Certification pipeline"
        subtitle="Build the bank, set the standard, certify the domain, then assess and credential — continuously."
        steps={steps}
        completedCount={completedCount}
        totalSteps={steps.length}
      />

      {/* Per-domain rollup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#5391D5]" /> Domain readiness &amp; throughput
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pe-3 font-medium">Domain</th>
                  <th className="py-2 px-3 font-medium text-center">Approved</th>
                  <th className="py-2 px-3 font-medium text-center">Status</th>
                  <th className="py-2 px-3 font-medium text-center">Assessed</th>
                  <th className="py-2 ps-3 font-medium text-center">Credentials</th>
                </tr>
              </thead>
              <tbody>
                {s.perDomain.map((d) => (
                  <tr key={d.domainKey} className="border-b last:border-0">
                    <td className="py-2 pe-3">
                      <Link href={`${ITEMS_HREF}?domain=${d.domainKey}`} className="font-medium text-[#010131] hover:text-[#5391D5] hover:underline">
                        {d.domainName}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-center tabular-nums text-muted-foreground">
                      {d.approved}/{d.minItems}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {d.certifiable ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] gap-1">
                          <Star className="h-3 w-3" /> Certifiable
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Indicative</Badge>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center tabular-nums">{d.assessed}</td>
                    <td className="py-2 ps-3 text-center tabular-nums">
                      {d.credentials > 0 ? (
                        <span className="font-semibold text-emerald-700">{d.credentials}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
