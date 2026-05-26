import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Aperture,
  Users,
  UserCheck,
  Layers,
  Sparkles,
  Clock,
  CheckCircle2,
  ClipboardList,
  Archive,
  FileDown,
  FileText,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { DebriefRowActions } from "./_components/debrief-row-actions";
import { ReflectReassessButton } from "./_components/reassess-button";

type Params = { params: Promise<{ id: string }> };

type EngagementDetail = {
  id: string;
  name: string;
  status: string;
  is_sandbox: boolean;
  default_language: string;
  report_language: string;
  anonymity_min_n: number;
  participant_target_count: number | null;
  field_window_start: string | null;
  field_window_end: string | null;
  created_at: string;
  launched_at: string | null;
  ara_organizations: { name: string; region: string; sector: string } | null;
};

type FrameworkRow = {
  id: string;
  name_en: string;
  name_ar: string | null;
  source: string;
  reflect_competencies: Array<{
    id: string;
    name_en: string;
    name_ar: string | null;
    display_order: number;
    reflect_behaviors: Array<{
      id: string;
      text_en: string;
      text_ar: string | null;
      source: string;
      display_order: number;
    }>;
  }>;
};

const STATUS_STYLE: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  draft: { label: "Draft", icon: Clock, className: "bg-amber-50 text-amber-700 border-amber-200" },
  live: { label: "Live", icon: Sparkles, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  scoring: { label: "Scoring", icon: ClipboardList, className: "bg-violet-50 text-violet-700 border-violet-200" },
  complete: { label: "Complete", icon: CheckCircle2, className: "bg-sky-50 text-sky-700 border-sky-200" },
  archived: { label: "Archived", icon: Archive, className: "bg-muted text-muted-foreground border-border" },
};

async function fetchEngagement(id: string) {
  const sb = createServiceClient();
  const [engRes, fwRes, participantsRes, ratersRes] = await Promise.all([
    sb
      .from("reflect_engagements")
      .select(
        "id, name, status, is_sandbox, default_language, report_language, anonymity_min_n, participant_target_count, field_window_start, field_window_end, created_at, launched_at, ara_organizations(name, region, sector)"
      )
      .eq("id", id)
      .maybeSingle(),
    sb
      .from("reflect_frameworks")
      .select(
        "id, name_en, name_ar, source, reflect_competencies(id, name_en, name_ar, display_order, reflect_behaviors(id, text_en, text_ar, source, display_order))"
      )
      .eq("engagement_id", id)
      .maybeSingle(),
    sb
      .from("reflect_participants")
      .select(
        "id, full_name, email, role_title, level_tier, language_preference, status, debrief_status, debrief_scheduled_at",
        { count: "exact" }
      )
      .eq("engagement_id", id)
      .order("full_name"),
    sb
      .from("reflect_raters")
      .select("id, rater_role, full_name, email, status, reflect_participants!inner(engagement_id)", { count: "exact" })
      .eq("reflect_participants.engagement_id", id),
  ]);

  if (!engRes.data) return null;

  return {
    engagement: engRes.data as unknown as EngagementDetail,
    framework: fwRes.data as unknown as FrameworkRow | null,
    participants: (participantsRes.data ?? []) as Array<{
      id: string;
      full_name: string;
      email: string;
      role_title: string | null;
      level_tier: string;
      language_preference: string;
      status: string;
      debrief_status: "not_scheduled" | "scheduled" | "completed" | "no_show";
      debrief_scheduled_at: string | null;
    }>,
    participantCount: participantsRes.count ?? 0,
    raterCount: ratersRes.count ?? 0,
  };
}

export default async function ReflectEngagementDetailPage({ params }: Params) {
  const { id } = await params;
  const data = await fetchEngagement(id);
  if (!data) notFound();

  const { engagement, framework, participants, participantCount, raterCount } = data;
  const status = STATUS_STYLE[engagement.status] ?? STATUS_STYLE.draft;
  const StatusIcon = status.icon;

  const behaviorCount =
    framework?.reflect_competencies.reduce(
      (sum, c) => sum + c.reflect_behaviors.length,
      0
    ) ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <Link
            href="/reflect/consultant"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-3 w-3" /> Consultant dashboard
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Aperture className="h-5 w-5 text-accent" />
                <h1 className="text-xl font-semibold text-primary">{engagement.name}</h1>
                {engagement.is_sandbox && (
                  <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-muted text-muted-foreground border">
                    Sandbox
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {engagement.ara_organizations?.name ?? "No organisation"}
                {engagement.ara_organizations && (
                  <>
                    {" · "}<span className="uppercase">{engagement.ara_organizations.region}</span>
                    {" · "}{engagement.ara_organizations.sector}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(engagement.status === "live" || engagement.status === "scoring" || engagement.status === "complete") && (
                <a
                  href={`/api/reflect/reports/cohort/${engagement.id}/pdf?language=${engagement.report_language}`}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
                  title="Download cohort report PDF"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Cohort report
                </a>
              )}
              {(engagement.status === "complete" || engagement.status === "archived" || engagement.status === "live") && (
                <ReflectReassessButton engagementId={engagement.id} />
              )}
              <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", status.className)}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Top stats */}
        <div className="grid gap-3 md:grid-cols-4">
          <Stat
            icon={Layers}
            tone="violet"
            label="Competencies"
            value={framework?.reflect_competencies.length ?? 0}
          />
          <Stat icon={Sparkles} tone="blue" label="Behaviours" value={behaviorCount} />
          <Stat icon={Users} tone="emerald" label="Participants" value={participantCount} />
          <Stat icon={UserCheck} tone="gold" label="Raters" value={raterCount} />
        </div>

        {/* Engagement metadata */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
            Configuration
          </h2>
          <dl className="grid gap-3 md:grid-cols-3 text-sm">
            <Meta label="Default language" value={engagement.default_language === "en" ? "English" : "Arabic"} />
            <Meta
              label="Report language"
              value={
                engagement.report_language === "bilingual"
                  ? "Bilingual (EN + AR)"
                  : engagement.report_language === "en"
                    ? "English only"
                    : "Arabic only"
              }
            />
            <Meta label="Anonymity threshold" value={`N = ${engagement.anonymity_min_n}`} />
            <Meta
              label="Target population"
              value={engagement.participant_target_count ? String(engagement.participant_target_count) : "-"}
            />
            <Meta
              label="Field window"
              value={
                engagement.field_window_start && engagement.field_window_end
                  ? `${engagement.field_window_start} → ${engagement.field_window_end}`
                  : engagement.field_window_start
                    ? `Opens ${engagement.field_window_start}`
                    : "Not set"
              }
            />
            <Meta
              label="Created"
              value={new Date(engagement.created_at).toLocaleString()}
            />
          </dl>
        </section>

        {/* Framework */}
        <section className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-primary uppercase tracking-wide">
                Framework
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {framework
                  ? `${framework.name_en}${framework.name_ar ? ` · ${framework.name_ar}` : ""} · source: ${framework.source}`
                  : "No framework attached"}
              </p>
            </div>
          </div>
          {!framework || framework.reflect_competencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No competencies yet. {framework?.source === "custom" ? "Add them from the framework editor (M3)." : "Re-run the wizard or pick a different path."}
            </p>
          ) : (
            <ul className="space-y-3">
              {framework.reflect_competencies
                .slice()
                .sort((a, b) => a.display_order - b.display_order)
                .map((c) => (
                  <li key={c.id} className="rounded-md border bg-muted/20 p-3">
                    <div className="text-sm font-semibold text-primary">
                      {c.name_en}
                      {c.name_ar && <span className="text-muted-foreground"> · {c.name_ar}</span>}
                    </div>
                    {c.reflect_behaviors.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {c.reflect_behaviors
                          .slice()
                          .sort((a, b) => a.display_order - b.display_order)
                          .map((b) => (
                            <li
                              key={b.id}
                              className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2"
                            >
                              <span className="mt-1 h-1 w-1 rounded-full bg-accent shrink-0" />
                              <span className="flex-1">
                                {b.text_en}
                                {b.source !== "manual" && (
                                  <span className="ms-2 inline-block text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-violet-50 text-violet-700 border border-violet-200">
                                    {b.source === "ai_proposed" ? "AI-proposed" : "AI-accepted"}
                                  </span>
                                )}
                                {b.text_ar && (
                                  <span dir="rtl" className="block text-[11px] text-muted-foreground/80 mt-0.5">
                                    {b.text_ar}
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </section>

        {/* Participants */}
        <section className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wide">
              Participants ({participantCount})
            </h2>
            {participants.length > 0 && (
              <a
                href={`/api/reflect/engagements/${engagement.id}/needs-scheduling.csv`}
                className="text-[11px] text-accent hover:underline"
                title="CSV of participants whose debrief still needs scheduling"
              >
                Download needs-scheduling CSV
              </a>
            )}
          </div>
          {participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No participants added.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Level</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Debrief</th>
                    <th className="py-2 pr-3 text-right">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.id} className="border-b last:border-b-0 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-primary">{p.full_name}</div>
                        <div className="text-[11px] text-muted-foreground">{p.email}</div>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{p.role_title ?? "-"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{p.level_tier}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-block text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-muted text-muted-foreground border">
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <DebriefRowActions
                          participantId={p.id}
                          initialStatus={p.debrief_status}
                          initialScheduledAt={p.debrief_scheduled_at}
                        />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {(engagement.status === "live" || engagement.status === "scoring" || engagement.status === "complete") ? (
                          <a
                            href={`/api/reflect/reports/${p.id}/pdf?language=${engagement.report_language}`}
                            className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                            title="Download participant report PDF"
                          >
                            <FileText className="h-3 w-3" /> PDF
                          </a>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const TONE_CLASSES = {
  blue: "bg-sky-50 text-sky-700 border-sky-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  gold: "bg-amber-50 text-amber-700 border-amber-200",
} as const;

function Stat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof Layers;
  tone: keyof typeof TONE_CLASSES;
  label: string;
  value: number;
}) {
  return (
    <div className={cn("rounded-lg border p-4 flex items-center gap-3", TONE_CLASSES[tone])}>
      <div className="h-9 w-9 rounded-lg bg-white/60 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold leading-none">{value}</div>
        <div className="text-[11px] uppercase tracking-wide mt-1">{label}</div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-primary mt-0.5 break-words">{value}</dd>
    </div>
  );
}
