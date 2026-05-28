import Link from "next/link";
import {
  ArrowLeft,
  Aperture,
  Plus,
  ClipboardList,
  Sparkles,
  CheckCircle2,
  Archive,
  Clock,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerT, type ServerT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Reflect 360 · Consultant",
};

type EngagementRow = {
  id: string;
  name: string;
  status: string;
  is_sandbox: boolean;
  participant_target_count: number | null;
  field_window_start: string | null;
  field_window_end: string | null;
  launched_at: string | null;
  created_at: string;
  ara_organizations: { name: string; region: string; sector: string } | null;
};

async function fetchEngagements(): Promise<EngagementRow[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("reflect_engagements")
    .select(
      "id, name, status, is_sandbox, participant_target_count, field_window_start, field_window_end, launched_at, created_at, ara_organizations(name, region, sector)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return [];
  return ((data ?? []) as unknown) as EngagementRow[];
}

const STATUS_STYLE: Record<string, { labelKey: string; icon: typeof Clock; className: string }> = {
  draft: {
    labelKey: "reflectConsultant.statusDraft",
    icon: Clock,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  live: {
    labelKey: "reflectConsultant.statusLive",
    icon: Sparkles,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  scoring: {
    labelKey: "reflectConsultant.statusScoring",
    icon: ClipboardList,
    className: "bg-violet-50 text-violet-700 border-violet-200",
  },
  complete: {
    labelKey: "reflectConsultant.statusComplete",
    icon: CheckCircle2,
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  archived: {
    labelKey: "reflectConsultant.statusArchived",
    icon: Archive,
    className: "bg-muted text-muted-foreground border-border",
  },
};

export default async function ReflectConsultantPage() {
  const engagements = await fetchEngagements();
  const t = await getServerT();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <Link
              href="/reflect"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
            >
              <ArrowLeft className="h-3 w-3" /> {t("reflectConsultant.backToReflect")}
            </Link>
            <div className="flex items-center gap-2">
              <Aperture className="h-5 w-5 text-accent" />
              <h1 className="text-xl font-semibold text-primary">{t("reflectConsultant.dashboardTitle")}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/reflect/consultant/engagements/new"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-xs font-medium text-white hover:bg-accent/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("reflectConsultant.newEngagement")}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {engagements.length === 0 ? (
          <EmptyState t={t} />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-primary uppercase tracking-wide">
                {t("reflectConsultant.yourEngagements")}
              </h2>
              <span className="text-xs text-muted-foreground">
                {t("reflectConsultant.totalCount", { count: engagements.length })}
              </span>
            </div>

            {engagements.map((e) => {
              const status = STATUS_STYLE[e.status] ?? STATUS_STYLE.draft;
              const StatusIcon = status.icon;
              return (
                <Link
                  key={e.id}
                  href={`/reflect/consultant/engagements/${e.id}`}
                  className="block rounded-lg border bg-card p-4 hover:border-accent/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-primary truncate">
                          {e.name}
                        </h3>
                        {e.is_sandbox && (
                          <span className="text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-muted text-muted-foreground border">
                            {t("reflectConsultant.sandbox")}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {e.ara_organizations?.name ?? t("reflectConsultant.noOrganisation")}
                        {e.ara_organizations && (
                          <>
                            {" · "}
                            <span className="uppercase">{e.ara_organizations.region}</span>
                            {" · "}
                            {e.ara_organizations.sector}
                          </>
                        )}
                        {e.participant_target_count && (
                          <>
                            {" · "}
                            {t("reflectConsultant.targetParticipants", { count: e.participant_target_count })}
                          </>
                        )}
                      </div>
                      {e.field_window_start && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {e.field_window_end
                            ? t("reflectConsultant.fieldWindowRange", { start: e.field_window_start, end: e.field_window_end })
                            : t("reflectConsultant.fieldWindow", { start: e.field_window_start })}
                        </div>
                      )}
                    </div>
                    <div
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                        status.className
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {t(status.labelKey)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ t }: { t: ServerT }) {
  return (
    <div className="ara-tile p-8 flex flex-col items-center text-center max-w-xl mx-auto">
      <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
        <ClipboardList className="h-5 w-5 text-accent" />
      </div>
      <h2 className="text-lg font-semibold text-primary mb-2">{t("reflectConsultant.emptyTitle")}</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {t("reflectConsultant.emptyBody")}
      </p>
      <Link
        href="/reflect/consultant/engagements/new"
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
      >
        <Plus className="h-4 w-4" />
        {t("reflectConsultant.emptyCta")}
      </Link>
    </div>
  );
}
