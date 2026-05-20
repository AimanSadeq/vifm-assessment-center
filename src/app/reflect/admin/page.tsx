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
import { ReflectAdminPurgeButtons } from "./_components/purge-buttons";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reflect · Admin",
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <Link
              href="/reflect"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
            >
              <ArrowLeft className="h-3 w-3" /> Reflect
            </Link>
            <div className="flex items-center gap-2">
              <Aperture className="h-5 w-5 text-accent" />
              <h1 className="text-xl font-semibold text-primary">Reflect Admin</h1>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {counts.totalEngagements} total engagement{counts.totalEngagements === 1 ? "" : "s"}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <p className="text-sm text-muted-foreground max-w-2xl mb-8">
          Admin console for VIFM Reflect — curate library templates that
          consultants clone into engagements, browse cross-consultant activity,
          and purge sandbox or retention-expired data.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Library templates */}
          <Card
            icon={Layers}
            tone="blue"
            title="Library templates"
            count={counts.templates}
            countLabel={counts.templates === 1 ? "template" : "templates"}
            description="Starter competency frameworks that consultants can clone when a client doesn't bring their own model."
          >
            <Link
              href="/reflect/admin/templates"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Browse templates <ArrowRight className="h-3 w-3" />
            </Link>
          </Card>

          {/* Active engagements */}
          <Card
            icon={ListChecks}
            tone="violet"
            title="Active engagements"
            count={counts.active}
            countLabel="active"
            description="Cross-consultant view of every Reflect engagement currently in draft, live, or scoring."
          >
            <Link
              href="/reflect/consultant"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Open consultant dashboard <ArrowRight className="h-3 w-3" />
            </Link>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Admin role sees every engagement via RLS.
            </p>
          </Card>

          {/* Sandbox purge */}
          <Card
            icon={FlaskConical}
            tone="teal"
            title="Sandbox data"
            count={counts.sandbox}
            countLabel={counts.sandbox === 1 ? "sandbox engagement" : "sandbox engagements"}
            description="Irreversibly delete every is_sandbox engagement and its cascade — frameworks, participants, raters, responses, IDPs, reports, logs."
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
            title="Data retention"
            count={counts.archivedEligible}
            countLabel="archived > 2y old"
            description="Irreversibly delete archived engagements whose archived_at is more than 2 years ago. Matches the project-wide PDPL retention posture."
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
