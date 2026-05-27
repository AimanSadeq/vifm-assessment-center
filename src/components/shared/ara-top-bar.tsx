import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { getServerT } from "@/lib/i18n/server";

/**
 * Slim, branded top bar used across ARA consultant and admin surfaces.
 * Sits above the page content and unifies the module's identity.
 */
export async function AraTopBar({
  role = "consultant",
}: {
  role?: "admin" | "consultant" | "public";
}) {
  const t = await getServerT();
  return (
    <header className="border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/ara" className="flex items-center gap-2">
            <VifmLogo variant="color" size="sm" />
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium border-l ps-3 ms-1">
              <Sparkles className="h-3 w-3 text-accent" />
              {t("araNav.compass")}
            </span>
          </Link>

          {role !== "public" && (
            <nav className="hidden md:flex items-center gap-1 text-sm">
              <NavLink href="/ara/consultant">{t("araNav.consultant")}</NavLink>
              <NavLink href="/ara/admin">{t("araNav.admin")}</NavLink>
              <NavLink href="/ara/engage">{t("araNav.engage")}</NavLink>
              <NavLink href="/ara/roadmap">{t("araNav.roadmap")}</NavLink>
            </nav>
          )}
        </div>

        <Link
          href="/admin"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          {t("araNav.assessmentCenter")} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      {children}
    </Link>
  );
}
