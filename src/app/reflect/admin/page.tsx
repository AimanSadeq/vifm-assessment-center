import Link from "next/link";
import {
  ArrowLeft,
  Layers,
  FlaskConical,
  FileClock,
  ListChecks,
  Aperture,
} from "lucide-react";

export const metadata = {
  title: "Reflect · Admin",
};

export default function ReflectAdminPage() {
  const tiles = [
    {
      icon: Layers,
      tone: "blue",
      title: "Library templates",
      description:
        "Manage starter competency frameworks that consultants can clone when a client doesn't bring their own model.",
      status: "Seeded · 1 template",
    },
    {
      icon: ListChecks,
      tone: "violet",
      title: "Active engagements",
      description:
        "Cross-consultant view of all in-flight 360° engagements with status, response rates, and debrief progress.",
      status: "M2 will populate",
    },
    {
      icon: FlaskConical,
      tone: "teal",
      title: "Sandbox data",
      description:
        "Clear all sandbox engagements with confirmation. Mirrors the ARA admin pattern.",
      status: "Pending M5",
    },
    {
      icon: FileClock,
      tone: "rose",
      title: "Data retention",
      description:
        "Purge archived engagements past their retention window (default 2 years). Same engine as ARA retention.",
      status: "Pending M5",
    },
  ] as const;

  const toneIcon: Record<string, string> = {
    blue: "ara-icon-blue",
    violet: "ara-icon-violet",
    teal: "ara-icon-teal",
    rose: "ara-icon-rose",
  };

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
              <h1 className="text-xl font-semibold text-primary">
                Reflect Admin
              </h1>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">M1 · scaffolding</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <p className="text-sm text-muted-foreground max-w-2xl mb-8">
          Admin console for VIFM Reflect — curate library templates, monitor
          active engagements across consultants, manage retention, and audit
          email and scoring activity. Most pages land in M2–M5; this is the
          M1 scaffolding view.
        </p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <div
                key={tile.title}
                className="ara-tile p-5 flex flex-col opacity-90"
              >
                <div
                  className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${toneIcon[tile.tone]}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-primary">
                  {tile.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1.5 flex-1">
                  {tile.description}
                </p>
                <div className="mt-3 text-[11px] text-muted-foreground uppercase tracking-wide">
                  {tile.status}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
