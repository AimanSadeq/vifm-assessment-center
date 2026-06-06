"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { SidebarBody } from "@/components/shared/portal-sidebar";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

/**
 * Mobile chrome for the platform left panel: a top bar with a hamburger (☰)
 * that opens the full sidebar as a slide-over drawer. Hidden at lg+ (where the
 * persistent <PortalSidebar /> shows instead). Shared by the admin layout and
 * the landing page so the left panel is reachable on a phone wherever the
 * sidebar exists. `actions` render on the trailing edge (e.g. a notification
 * bell); omit on surfaces that don't need them.
 */
export function MobileSidebar({ actions }: { actions?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card px-4 py-3 lg:hidden">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <VifmLogo variant="color" size="sm" />
        {actions && <div className="ms-auto">{actions}</div>}
      </div>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Slide-over drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 flex w-64 flex-col border-e bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="absolute end-3 top-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-sidebar-foreground/60 hover:text-sidebar-foreground"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <SidebarBody collapsed={false} onNavigate={() => setOpen(false)} />
      </aside>
    </>
  );
}
