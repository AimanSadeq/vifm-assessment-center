import Link from "next/link";
import { UserSearch, LayoutGrid, GraduationCap, ClipboardList } from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { getServerT, getServerLocale, getServerDir } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Pre-Hire service shell — a standalone immersive chrome (its own top bar +
 * rose identity + footer), distinct from the admin portal. The admin layout
 * steps aside for /admin/prehire/* (see src/app/admin/layout.tsx), so this
 * layout fully owns the page. Navigation back to the rest of the platform is
 * via the top bar ("All services"), mirroring how AR Compass / Reflect / Fluent
 * present as peer services.
 */
export default async function PrehireLayout({ children }: { children: React.ReactNode }) {
  const t = await getServerT();
  const dir = getServerDir(await getServerLocale());
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FA]" dir={dir}>
      {/* Branded top bar */}
      <header className="bg-[#010131]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <VifmLogo variant="white" size="sm" />
            <span className="hidden h-5 w-px bg-white/20 sm:block" />
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
              <UserSearch className="h-4 w-4 text-[#FDA4AF]" /> {t("adminNav.preHire")}
            </span>
          </div>
          <nav className="flex items-center gap-1.5 text-xs font-medium">
            <Link
              href="/admin/prehire"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15"
            >
              <ClipboardList className="h-3.5 w-3.5" /> {t("prehire.navRequisitions")}
            </Link>
            <Link
              href="/courses"
              className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15 sm:inline-flex"
            >
              <GraduationCap className="h-3.5 w-3.5" /> {t("prehire.navCatalogue")}
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white/60 transition-colors hover:text-white"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> {t("adminNav.allServices")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Branded footer */}
      <footer className="border-t bg-card/50">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-4 sm:flex-row sm:items-center">
          <div className="text-xs text-muted-foreground">
            <div className="mb-0.5 font-medium text-foreground">Virginia Institute of Finance and Management</div>
            {t("prehire.footerConfidential")}
          </div>
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
            {t("adminNav.allServices")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
