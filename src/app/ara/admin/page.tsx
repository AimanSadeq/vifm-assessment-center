import Link from "next/link";
import { Building2, Database, FileText, FlaskConical, FileClock, ArrowRight } from "lucide-react";
import { AraTopBar } from "@/components/shared/ara-top-bar";

export default function AraAdminPage() {
  const tiles = [
    {
      href: "/ara/admin/organizations",
      icon: Building2,
      title: "Organizations",
      description: "Manage client organizations by region and sector.",
      status: "Ready",
    },
    {
      href: "/ara/admin/questions",
      icon: Database,
      title: "Question Bank",
      description: "Author, version, and publish Layer 1 + Layer 2 questions.",
      status: "Ready",
    },
    {
      href: null,
      icon: FileText,
      title: "Regulatory Docs",
      description: "Upload regulatory documents; AI-extract requirements.",
      status: "Coming in M4",
    },
    {
      href: "/ara/admin/sandbox",
      icon: FlaskConical,
      title: "Sandbox Data",
      description: "Clear all sandbox assessments with confirmation.",
      status: "Ready",
    },
    {
      href: "/ara/admin/retention",
      icon: FileClock,
      title: "Data Retention",
      description: "Purge archived assessments older than 3 years.",
      status: "Ready",
    },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <AraTopBar role="admin" />

      {/* Hero strip */}
      <section className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <span className="ara-eyebrow">Admin</span>
          <h1 className="ara-numeral text-3xl font-semibold text-primary mt-2">Admin Console</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            VIFM staff — curate the question bank, seed regulatory content,
            manage sandbox data, and oversee data retention.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            const ready = tile.status === "Ready";
            const inner = (
              <div className={`ara-tile p-6 h-full flex flex-col ${!tile.href ? "opacity-60 pointer-events-none" : ""}`}>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-4 ${ready ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-primary mb-1">{tile.title}</h3>
                <p className="text-sm text-muted-foreground flex-1">{tile.description}</p>
                <div className={`mt-4 inline-flex items-center gap-1 text-xs font-medium ${ready ? "text-accent" : "text-muted-foreground"}`}>
                  {ready ? (
                    <>Open <ArrowRight className="h-3 w-3" /></>
                  ) : (
                    tile.status
                  )}
                </div>
              </div>
            );
            return tile.href ? (
              <Link key={tile.title} href={tile.href}>{inner}</Link>
            ) : (
              <div key={tile.title}>{inner}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
