import Link from "next/link";
import {
  ArrowLeft,
  Layers,
  FlaskConical,
  FileClock,
  ListChecks,
  Aperture,
  ArrowRight,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { ReflectAdminPurgeButtons } from "./_components/purge-buttons";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reflect 360 · Admin",
};

async function fetchCounts() {
  const sb = createServiceClient();
  const cutoff = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();

  const [templates, sandbox, active, archivedEligible, totalEngagements] = await Promise.all([
    sb.from("reflect_frameworks").select("id", { count: "exact", head: true }).eq("is_template", true),
    sb.from("reflect_engagements").select("id", { count: "exact", head: true }).eq("is_sandbox", true),
    sb.from("reflect_engagements").select("id", { count: "exact", head: true }).in("status", ["draft", "live", "scoring"]),
    sb.from("reflect_engagements").select("id", { count: "exact", head: true }).eq("status", "archived").lt("archived_at", cutoff),
    sb.from("reflect_engagements").select("id", { count: "exact", head: true }),
  ]);

  return {
    templates: templates.count ?? 0,
    sandbox: sandbox.count ?? 0,
    active: active.count ?? 0,
    archivedEligible: archivedEligible.count ?? 0,
    totalEngagements: totalEngagements.count ?? 0,
  };
}

export default async function ReflectAdminPage() {
  const counts = await fetchCounts();
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
              <ArrowLeft className="h-3 w-3" /> Reflect 360
            </Link>
            <div className="flex items-center gap-2">
              <Aperture className="h-5 w-5 text-accent" />
              <h1 className="text-xl font-semibold text-primary">{t("reflectAdmin.home.headerTitle")}</h1>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {t(
              counts.totalEngagements === 1
                ? "reflectAdmin.home.totalEngagements_one"
                : "reflectAdmin.home.totalEngagements_other",
              { count: counts.totalEngagements }
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <p className="text-sm text-muted-foreground max-w-2xl mb-8">
          {t("reflectAdmin.home.intro")}
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Library templates */}
          <Card
            icon={Layers}
            tone="blue"
            title={t("reflectAdmin.home.templates.title")}
            count={counts.templates}
            countLabel={t(
              counts.templates === 1
                ? "reflectAdmin.home.templates.countLabel_one"
                : "reflectAdmin.home.templates.countLabel_other"
            )}
            description={t("reflectAdmin.home.templates.description")}
          >
            <Link
              href="/reflect/admin/templates"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              {t("reflectAdmin.home.templates.cta")} <ArrowRight className="h-3 w-3" />
            </Link>
          </Card>

          {/* Active engagements */}
          <Card
            icon={ListChecks}
            tone="violet"
            title={t("reflectAdmin.home.active.title")}
            count={counts.active}
            countLabel={t("reflectAdmin.home.active.countLabel")}
            description={t("reflectAdmin.home.active.description")}
          >
            <Link
              href="/reflect/consultant"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              {t("reflectAdmin.home.active.cta")} <ArrowRight className="h-3 w-3" />
            </Link>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {t("reflectAdmin.home.active.note")}
            </p>
          </Card>

          {/* Sandbox purge */}
          <Card
            icon={FlaskConical}
            tone="teal"
            title={t("reflectAdmin.home.sandbox.title")}
            count={counts.sandbox}
            countLabel={t(
              counts.sandbox === 1
                ? "reflectAdmin.home.sandbox.countLabel_one"
                : "reflectAdmin.home.sandbox.countLabel_other"
            )}
            description={t("reflectAdmin.home.sandbox.description")}
          >
            <ReflectAdminPurgeButtons
              variant="sandbox"
              count={counts.sandbox}
            />
          </Card>

          {/* Retention purge */}
          <Card
            icon={FileClock}
            tone="rose"
            title={t("reflectAdmin.home.retention.title")}
            count={counts.archivedEligible}
            countLabel={t("reflectAdmin.home.retention.countLabel")}
            description={t("reflectAdmin.home.retention.description")}
          >
            <ReflectAdminPurgeButtons
              variant="retention"
              count={counts.archivedEligible}
            />
          </Card>
        </div>
      </main>
    </div>
  );
}

const TONE_ICON: Record<string, string> = {
  blue: "ara-icon-blue",
  violet: "ara-icon-violet",
  teal: "ara-icon-teal",
  rose: "ara-icon-rose",
};

function Card({
  icon: Icon,
  tone,
  title,
  count,
  countLabel,
  description,
  children,
}: {
  icon: typeof Layers;
  tone: "blue" | "violet" | "teal" | "rose";
  title: string;
  count: number;
  countLabel: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ara-tile p-5 flex flex-col">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${TONE_ICON[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-base font-semibold text-primary">{title}</h3>
      <div className="mt-1 mb-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold text-primary">{count}</span>
        <span className="text-xs text-muted-foreground">{countLabel}</span>
      </div>
      <p className="text-sm text-muted-foreground flex-1">{description}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
