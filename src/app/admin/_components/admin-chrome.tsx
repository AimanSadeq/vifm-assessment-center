"use client";

import { usePathname } from "next/navigation";
import { NotificationBellClient } from "@/components/shared/notification-bell-client";
import { PortalSidebar } from "@/components/shared/portal-sidebar";
import { MobileSidebar } from "@/components/shared/mobile-sidebar";
import { AllServicesLink } from "@/components/shared/all-services-link";

// The admin chrome (sidebar + top bar). Split out of the layout so the layout
// itself can be a server component that gates the whole /admin surface to the
// admin role (see ./layout.tsx). usePathname keeps the Pre-Hire immersive
// short-circuit working.
export function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Pre-Hire is a standalone service with its own immersive shell - step the
  // admin chrome aside for its subtree (see src/app/admin/prehire/layout.tsx).
  if (pathname?.startsWith("/admin/prehire")) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar (collapsible) */}
      <PortalSidebar />

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar + slide-over drawer (lg:hidden) */}
        <MobileSidebar actions={<NotificationBellClient />} />

        {/* Desktop top bar - All services + bell, right-aligned */}
        <div className="hidden items-center justify-end gap-2 border-b bg-card px-6 py-2 lg:flex">
          <AllServicesLink />
          <NotificationBellClient />
        </div>

        <main className="flex-1 overflow-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
