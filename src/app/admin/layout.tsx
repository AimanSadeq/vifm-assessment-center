"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { NotificationBellClient } from "@/components/shared/notification-bell-client";
import { PortalSidebar, SidebarBody } from "@/components/shared/portal-sidebar";
import { AllServicesLink } from "@/components/shared/all-services-link";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

// The nav links + sidebar markup live in @/components/shared/portal-sidebar so
// the admin chrome and the platform landing page share one left panel. This
// layout owns only the mobile drawer state + top bar.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Pre-Hire is a standalone service with its own immersive shell — step the
  // admin chrome aside for its subtree (see src/app/admin/prehire/layout.tsx).
  if (pathname?.startsWith("/admin/prehire")) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Desktop sidebar (collapsible) */}
      <PortalSidebar />

      {/* Mobile sidebar (slide-over) */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 w-52 bg-sidebar text-sidebar-foreground flex flex-col border-e transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="absolute top-3 end-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <SidebarBody collapsed={false} onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 border-b bg-card px-4 py-3">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <VifmLogo variant="color" size="sm" />
          <div className="ms-auto">
            <NotificationBellClient />
          </div>
        </div>

        {/* Desktop top bar - All services + bell, right-aligned */}
        <div className="hidden lg:flex items-center justify-end gap-2 border-b bg-card px-6 py-2">
          <AllServicesLink />
          <NotificationBellClient />
        </div>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
