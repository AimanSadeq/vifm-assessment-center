import Link from "next/link";
import { Plus, FlaskConical, ClipboardList, CheckCircle2, Snowflake, User, ArrowRight } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AraTopBar } from "@/components/shared/ara-top-bar";
import { ARA_STAGE_MAP } from "@/lib/constants/ara-stages";
import type { AraAssessment, AraOrganization } from "@/types/ara";

export const dynamic = "force-dynamic";

type AssessmentRow = AraAssessment & {
  organization: Pick<AraOrganization, "id" | "name" | "name_ar"> | null;
};

type ChipTone = "blue" | "emerald" | "teal" | "gold" | "violet";

const CHIP_TONE_MAP: Record<ChipTone, { wrap: string; value: string; icon: string }> = {
  blue:    { wrap: "bg-accent/5 border-accent/30",          value: "text-accent",            icon: "text-accent" },
  emerald: { wrap: "bg-[#059669]/5 border-[#059669]/30",    value: "text-[#059669]",         icon: "text-[#059669]" },
  teal:    { wrap: "bg-[#0D9488]/5 border-[#0D9488]/30",    value: "text-[#0D9488]",         icon: "text-[#0D9488]" },
  gold:    { wrap: "bg-[#D97706]/5 border-[#D97706]/30",    value: "text-[#D97706]",         icon: "text-[#D97706]" },
  violet:  { wrap: "bg-[#7C3AED]/5 border-[#7C3AED]/30",    value: "text-[#7C3AED]",         icon: "text-[#7C3AED]" },
};

function StatChip({
  icon: Icon, label, value, tone,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: number;
  tone?: ChipTone;
}) {
  const t = tone ? CHIP_TONE_MAP[tone] : { wrap: "bg-muted/30", value: "text-primary", icon: "text-muted-foreground" };
  return (
    <div className={`rounded-lg border px-3 py-2 min-w-[88px] ${t.wrap}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={`h-3 w-3 ${t.icon}`} /> {label}
      </div>
      <div className={`ara-numeral text-xl font-semibold mt-0.5 ${t.value}`}>
        {value}
      </div>
    </div>
  );
}

const statusVariant: Record<AraAssessment["status"], "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  active: "default",
  completed: "secondary",
  frozen: "secondary",
  archived: "destructive",
};

export default async function AraConsultantPage() {
  const sb = createServiceClient();

  // Org-side assessments only - personal snapshots have a separate
  // panel below so they don't inflate the consultant's pipeline.
  const { data: rows } = await sb
    .from("ara_assessments")
    .select("*, organization:ara_organizations(id, name, name_ar)")
    .neq("engagement_stage", "individual")
    .order("created_at", { ascending: false })
    .returns<AssessmentRow[]>();

  // Personal snapshots in the last 30 days - fire-and-forget panel.
  // We use service-role here because consultant RLS doesn't grant
  // visibility on individual-stage rows (no consultant_id), and the
  // intel value of seeing self-served activity is high.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  type PersonalSnapshotRow = {
    id: string;
    created_at: string;
    scope_label: string | null;
    assessment_tier: "snapshot" | "deep_dive";
    respondent: { name: string; email: string; completed_at: string | null; access_token: string | null }[] | null;
  };
  const { data: personalRows } = await sb
    .from("ara_assessments")
    .select(
      "id, created_at, scope_label, assessment_tier, " +
      "respondent:ara_respondents(name, email, completed_at, access_token)"
    )
    .eq("engagement_stage", "individual")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<PersonalSnapshotRow[]>();
  const personalSnapshots = (personalRows ?? []).map((row) => {
    const r = row.respondent?.[0] ?? null;
    return {
      id: row.id,
      created_at: row.created_at,
      tier: row.assessment_tier ?? "snapshot",
      name: r?.name ?? row.scope_label ?? "Anonymous",
      email: r?.email ?? null,
      completed_at: r?.completed_at ?? null,
      access_token: r?.access_token ?? null,
    };
  });
  const personalCompletedCount = personalSnapshots.filter((p) => p.completed_at).length;
  const personalDeepDiveCount = personalSnapshots.filter((p) => p.tier === "deep_dive").length;

  // Aggregate: total + per-status counts for the pipeline funnel.
  const all = rows ?? [];
  const total = all.length;
  const completed = all.filter((r) => r.status === "completed" || r.status === "frozen").length;
  const frozen = all.filter((r) => r.status === "frozen").length;
  const pipeline: Array<{ key: AraAssessment["status"]; label: string; count: number; color: string }> = [
    { key: "draft",     label: "Draft",     count: all.filter((r) => r.status === "draft").length,     color: "#9ca3af" },
    { key: "active",    label: "Active",    count: all.filter((r) => r.status === "active").length,    color: "#5391D5" },
    { key: "completed", label: "Completed", count: all.filter((r) => r.status === "completed").length, color: "#FBBF24" },
    { key: "frozen",    label: "Frozen",    count: all.filter((r) => r.status === "frozen").length,    color: "#34D399" },
    { key: "archived",  label: "Archived",  count: all.filter((r) => r.status === "archived").length,  color: "#6b7280" },
  ];
  const pipelineMax = Math.max(1, ...pipeline.map((p) => p.count));

  return (
    <div className="min-h-screen bg-background">
      <AraTopBar role="consultant" />

      {/* ─── Hero strip ─── */}
      <section className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="ara-eyebrow">Consultant · AI Readiness Compass</span>
            <h1 className="ara-numeral text-3xl font-semibold text-primary mt-2">Assessments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your Compass engagements across GCC clients.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatChip icon={ClipboardList} label="Total"     value={total}     tone="blue" />
            <StatChip icon={CheckCircle2}  label="Completed" value={completed} tone="emerald" />
            <StatChip icon={Snowflake}     label="Frozen"    value={frozen}    tone="teal" />
            <Link href="/ara/consultant/personal-deep-dive/new" className="ms-2">
              <Button variant="outline" className="gap-2">
                <User className="h-4 w-4" /> New deep-dive
              </Button>
            </Link>
            <Link href="/ara/consultant/assessments/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> New assessment
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* ─── Pipeline funnel ─── *
         * Status-by-status counts visualised as a horizontal bar chart.
         * Each segment is sized relative to the largest segment so even
         * a small set of assessments produces a readable distribution. */}
        {rows && rows.length > 0 && (
          <div className="mb-8 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="ara-eyebrow">Pipeline</span>
              <span className="text-xs text-muted-foreground">
                {total} assessment{total === 1 ? "" : "s"} · {completed} progressed past Active
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {pipeline.map((s) => {
                const widthPct = (s.count / pipelineMax) * 100;
                return (
                  <div key={s.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                        {s.label}
                      </span>
                      <span className="ara-numeral text-sm font-semibold text-foreground">
                        {s.count}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${widthPct}%`, background: s.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Personal snapshot activity (last 30d) ─── *
         * Self-served Personal AI Readiness Snapshots aren't owned by
         * any consultant, but they're a valuable signal for VIFM's
         * adoption funnel. Surface the recent activity in a quiet
         * panel so consultants can spot trends without it competing
         * with their org-side pipeline. */}
        {personalSnapshots.length > 0 && (
          <div className="mb-8 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="ara-eyebrow flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  Personal snapshots · last 30 days
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {personalSnapshots.length} started · {personalCompletedCount} completed
                  {personalDeepDiveCount > 0 && ` · ${personalDeepDiveCount} deep-dive`}
                </Badge>
              </div>
              <Link
                href="/ara/personal/start"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-accent hover:underline inline-flex items-center gap-1"
              >
                Open public start page <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personalSnapshots.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.email}</TableCell>
                    <TableCell>
                      {p.tier === "deep_dive" ? (
                        <Badge className="bg-violet-600 hover:bg-violet-600 text-[10px]">
                          Deep-dive · 48 items
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Snapshot · 24 items
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      {p.completed_at ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          In progress
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.completed_at && p.access_token && (
                        <Link
                          href={`/ara/personal/results/${p.access_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="View snapshot"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!rows || rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-16 text-center bg-card">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium text-foreground">No assessments yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-sm mx-auto">
              Create your first engagement to invite respondents, gather evidence, and begin Phase 1 discovery.
            </p>
            <Link href="/ara/consultant/assessments/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Create first assessment
              </Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Sandbox</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const stageId = (row.engagement_stage ?? "enterprise") as keyof typeof ARA_STAGE_MAP;
                const stage = ARA_STAGE_MAP[stageId] ?? ARA_STAGE_MAP.enterprise;
                const stageColor =
                  stage.tone === "teal" ? "#0D9488" :
                  stage.tone === "violet" ? "#7C3AED" :
                  "#D97706";
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href={`/ara/consultant/assessments/${row.id}`} className="font-medium hover:underline">
                        {row.organization?.name ?? "(no organization)"}
                      </Link>
                      {row.scope_label && (
                        <div className="text-xs text-muted-foreground">{row.scope_label}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-widest whitespace-nowrap"
                        style={{
                          background: `${stageColor}15`,
                          color: stageColor,
                          border: `1px solid ${stageColor}40`,
                        }}
                      >
                        S{stage.number} · {stage.label_en}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.region === "uae" ? "default" : "secondary"}>
                        {row.region === "uae" ? "UAE" : "Saudi"}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{row.sector}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[row.status]} className="capitalize">
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{row.phase.replace("phase", "Phase ")}</TableCell>
                    <TableCell>
                      {row.is_sandbox ? (
                        <span title="Sandbox assessment" className="inline-flex items-center gap-1 text-amber-600">
                          <FlaskConical className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
