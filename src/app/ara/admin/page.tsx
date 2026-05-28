import Link from "next/link";
import { Building2, Database, FileText, FlaskConical, FileClock, ArrowRight } from "lucide-react";
import { AraTopBar } from "@/components/shared/ara-top-bar";
import { getServerT } from "@/lib/i18n/server";

export default async function AraAdminPage() {
  const t = await getServerT();
  const tiles = [
    {
      href: "/ara/admin/organizations",
      icon: Building2,
      tone: "blue",
      title: t("araAdmin.tileOrganizationsTitle"),
      description: t("araAdmin.tileOrganizationsDesc"),
      status: "Ready",
    },
    {
      href: "/ara/admin/questions",
      icon: Database,
      tone: "violet",
      title: t("araAdmin.tileQuestionBankTitle"),
      description: t("araAdmin.tileQuestionBankDesc"),
      status: "Ready",
    },
    {
      href: "/ara/admin/regulatory",
      icon: FileText,
      tone: "gold",
      title: t("araAdmin.tileRegulatoryTitle"),
      description: t("araAdmin.tileRegulatoryDesc"),
      status: "Ready",
    },
    {
      href: "/ara/admin/sandbox",
      icon: FlaskConical,
      tone: "teal",
      title: t("araAdmin.tileSandboxTitle"),
      description: t("araAdmin.tileSandboxDesc"),
      status: "Ready",
    },
    {
      href: "/ara/admin/retention",
      icon: FileClock,
      tone: "rose",
      title: t("araAdmin.tileRetentionTitle"),
      description: t("araAdmin.tileRetentionDesc"),
      status: "Ready",
    },
  ] as const;

  const toneIconClass: Record<string, string> = {
    blue: "ara-icon-blue",
    violet: "ara-icon-violet",
    teal: "ara-icon-teal",
    gold: "ara-icon-gold",
    emerald: "ara-icon-emerald",
    rose: "ara-icon-rose",
  };
  const toneArrowClass: Record<string, string> = {
    blue: "text-accent",
    violet: "text-[#7C3AED]",
    teal: "text-[#0D9488]",
    gold: "text-[#D97706]",
    emerald: "text-[#059669]",
    rose: "text-[#E11D48]",
  };

  return (
    <div className="min-h-screen bg-background">
      <AraTopBar role="admin" />

      {/* Hero strip */}
      <section className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <span className="ara-eyebrow">{t("araAdmin.heroEyebrow")}</span>
          <h1 className="ara-numeral text-3xl font-semibold text-primary mt-2">{t("araAdmin.heroTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("araAdmin.heroSubtitle")}
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            const ready = tile.status === "Ready";
            const iconClass = ready ? toneIconClass[tile.tone] : "bg-muted text-muted-foreground";
            const arrowClass = ready ? toneArrowClass[tile.tone] : "text-muted-foreground";
            const inner = (
              <div className={`ara-tile p-6 h-full flex flex-col ${!tile.href ? "opacity-60 pointer-events-none" : ""}`}>
                <div className={`ara-tile-icon h-10 w-10 rounded-lg flex items-center justify-center mb-4 ${iconClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-primary mb-1">{tile.title}</h3>
                <p className="text-sm text-muted-foreground flex-1">{tile.description}</p>
                <div className={`mt-4 inline-flex items-center gap-1 text-xs font-medium ${arrowClass}`}>
                  {ready ? (
                    <>{t("araAdmin.tileOpen")} <ArrowRight className="h-3 w-3" /></>
                  ) : (
                    tile.status
                  )}
                </div>
              </div>
            );
            // Every tile is wired to an href today; if a future tile is
            // disabled (href: null) re-introduce the conditional render.
            return (
              <Link key={tile.title} href={tile.href}>{inner}</Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
