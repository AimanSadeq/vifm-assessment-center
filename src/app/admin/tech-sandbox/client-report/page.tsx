import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3, Users, PlayCircle, CheckCircle2, ArrowRight, Download,
  TrendingUp, AlertTriangle, GraduationCap,
} from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listTechCompanies, buildClientReport } from "@/lib/reports/tech-aggregation/aggregate";
import type { LevelMetrics, Insight } from "@/lib/reports/tech-aggregation/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Technical client report · VIFM" };

type Props = { searchParams: { company?: string } };

/** emerald >=85 / sky >=70 / amber >=60 / rose <60 - mirrors the proficiency bands. */
function tone(pct: number | null): { fg: string; bar: string } {
  if (pct == null) return { fg: "#475569", bar: "#cbd5e1" };
  if (pct >= 85) return { fg: "#047857", bar: "#059669" };
  if (pct >= 70) return { fg: "#0369a1", bar: "#0284c7" };
  if (pct >= 60) return { fg: "#92400e", bar: "#d97706" };
  return { fg: "#991b1b", bar: "#dc2626" };
}

export default async function TechClientReportPage({ searchParams }: Props) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }

  const company = (searchParams.company ?? "").trim();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-4">
        <BackLink href="/admin/tech-sandbox" label="Back to Techno®" history />
      </div>
      {company ? <CompanyReport company={company} /> : <CompanyPicker />}
    </div>
  );
}

// ── Picker ──────────────────────────────────────────────────────
async function CompanyPicker() {
  const companies = await listTechCompanies();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BarChart3 className="h-6 w-6 text-accent" /> Technical client reports
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aggregate technical-assessment results by company and project line - participation, skill
          profiles, gaps, and data-driven training recommendations.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Companies</CardTitle>
          <CardDescription>Across the technical sandbox and MCQ portals, grouped by client company.</CardDescription>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No technical results yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pe-3 font-medium">Company</th>
                    <th className="py-2 pe-3 font-medium">Invited</th>
                    <th className="py-2 pe-3 font-medium">Completed</th>
                    <th className="py-2 pe-3 font-medium">Projects</th>
                    <th className="py-2 pe-3 font-medium">Domains</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.companyKey} className="border-b border-border/60">
                      <td className="py-2 pe-3 font-medium">{c.companyLabel}</td>
                      <td className="py-2 pe-3 tabular-nums">{c.invited}</td>
                      <td className="py-2 pe-3 tabular-nums">{c.completed}</td>
                      <td className="py-2 pe-3 tabular-nums">{c.projects}</td>
                      <td className="py-2 pe-3 tabular-nums">{c.domains}</td>
                      <td className="py-2 text-right">
                        <Link
                          href={`/admin/tech-sandbox/client-report?company=${encodeURIComponent(c.companyLabel)}`}
                          className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          View report <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Company report ──────────────────────────────────────────────
async function CompanyReport({ company }: { company: string }) {
  const report = await buildClientReport(company, { generatedAt: new Date().toISOString() });
  if (!report) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{company}</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No technical results for this company yet.</p>
            <Link href="/admin/tech-sandbox/client-report" className="mt-3 inline-block text-sm text-accent hover:underline">
              All companies
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart3 className="h-6 w-6 text-accent" /> {report.company_label}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Technical client report · {report.projects.length} project{report.projects.length === 1 ? "" : "s"} ·
            portals: {report.portals.join(", ") || "none"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["pdf", "json", "csv"] as const).map((fmt) => (
            <Link
              key={fmt}
              href={`/api/tech-sandbox/client-report?company=${encodeURIComponent(report.company_label)}&format=${fmt}`}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted/40"
            >
              <Download className="h-3.5 w-3.5" /> {fmt.toUpperCase()}
            </Link>
          ))}
          <Link href="/admin/tech-sandbox/client-report" className="text-sm text-accent hover:underline">
            All companies
          </Link>
        </div>
      </div>

      {/* Company-level metrics */}
      <MetricsBlock title="Company overall" metrics={report.company_metrics} />

      {/* Company insights */}
      <InsightSections insights={report.company_overall_insights} heading="Company insights" />

      {/* Projects */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-[#010131]">Projects</h2>
        <div className="space-y-5">
          {report.projects.map((p) => (
            <Card key={p.project_id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{p.project_label}</CardTitle>
                <CardDescription>
                  {p.project_metrics.participation.completed} of {p.project_metrics.participation.invited} completed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetricsBlock metrics={p.project_metrics} compact />
                {p.project_insights.length > 0 && <InsightSections insights={p.project_insights} compact />}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricsBlock({ title, metrics, compact }: { title?: string; metrics: LevelMetrics; compact?: boolean }) {
  const part = metrics.participation;
  return (
    <Card>
      {title && (
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={compact ? "pt-0 space-y-4" : "space-y-4"}>
        {/* Funnel */}
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat icon={<Users className="h-4 w-4" />} label="Invited" value={part.invited} />
          <Stat icon={<PlayCircle className="h-4 w-4" />} label="Started" value={part.started} />
          <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={part.completed} />
          <Stat icon={<TrendingUp className="h-4 w-4" />} label="Completion" value={`${Math.round(part.completionRate * 100)}%`} />
        </div>

        {/* Skill profiles */}
        {metrics.skill_profiles.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pe-3 font-medium">Domain</th>
                  <th className="py-1.5 pe-3 font-medium text-right">Avg</th>
                  <th className="py-1.5 pe-3 font-medium text-right">High</th>
                  <th className="py-1.5 pe-3 font-medium text-right">Low</th>
                  <th className="py-1.5 pe-3 font-medium text-right">n</th>
                  <th className="py-1.5 font-medium">Profile</th>
                </tr>
              </thead>
              <tbody>
                {metrics.skill_profiles.map((d) => {
                  const t = tone(d.averagePct);
                  const gap = metrics.skill_gaps.find((g) => g.domainKey === d.domainKey);
                  return (
                    <tr key={d.domainKey} className="border-b border-border/60">
                      <td className="py-1.5 pe-3">
                        {d.domainLabel}
                        {gap && (
                          <span className="ms-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                            gap {gap.gapPct}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pe-3 text-right font-semibold tabular-nums" style={{ color: t.fg }}>{d.averagePct}%</td>
                      <td className="py-1.5 pe-3 text-right tabular-nums text-muted-foreground">{d.highestPct}%</td>
                      <td className="py-1.5 pe-3 text-right tabular-nums text-muted-foreground">{d.lowestPct}%</td>
                      <td className="py-1.5 pe-3 text-right tabular-nums text-muted-foreground">{d.n}</td>
                      <td className="py-1.5 w-28">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${d.averagePct}%`, backgroundColor: t.bar }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No completed, scored results yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function InsightSections({ insights, heading, compact }: { insights: Insight[]; heading?: string; compact?: boolean }) {
  const groups = [
    { kind: "strength" as const, label: "Key strengths", icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" /> },
    { kind: "vulnerability" as const, label: "Critical vulnerabilities", icon: <AlertTriangle className="h-4 w-4 text-rose-600" /> },
    { kind: "recommendation" as const, label: "Training recommendations", icon: <GraduationCap className="h-4 w-4 text-accent" /> },
  ];
  const present = groups.filter((g) => insights.some((i) => i.kind === g.kind));
  if (present.length === 0) return null;
  const body = (
    <div className={compact ? "space-y-3" : "grid gap-3 md:grid-cols-3"}>
      {present.map((g) => (
        <div key={g.kind} className="rounded-lg border bg-card p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#010131]">
            {g.icon} {g.label}
          </p>
          <ul className="space-y-2">
            {insights.filter((i) => i.kind === g.kind).map((i, idx) => (
              <li key={idx} className="text-xs leading-snug">
                <span className="font-semibold text-foreground">{i.title}</span>
                <span className="text-muted-foreground"> - {i.detail}</span>
                {i.courseCodes && i.courseCodes.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {i.courseCodes.map((code) => (
                      <Badge key={code} variant="outline" className="text-[10px] font-mono">{code}</Badge>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
  if (compact) return body;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{heading ?? "Insights"}</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">{icon}</div>
      <div>
        <div className="text-xl font-bold tabular-nums leading-none">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
