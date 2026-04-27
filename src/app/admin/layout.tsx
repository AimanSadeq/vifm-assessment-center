"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { LogoutButton } from "@/components/shared/logout-button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  Target,
  Users,
  BarChart3,
  Briefcase,
  Settings,
  User,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const sidebarLinks: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clients", icon: Building2 },
  { href: "/admin/engagements", label: "Projects", icon: ClipboardList },
  { href: "/admin/role-profiles", label: "Role Profiles", icon: Briefcase },
  { href: "/admin/exercises", label: "Exercises", icon: Target },
  { href: "/admin/assessors", label: "Assessors", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/ara", label: "AI Readiness", icon: Sparkles },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={cn("p-4", collapsed && "px-2")}>
        <Link href="/admin" className="flex items-center gap-3">
          {collapsed ? (
            <VifmLogo variant="white" size="sm" className="mx-auto" />
          ) : (
            <VifmLogo variant="white" size="sm" showTagline />
          )}
        </Link>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        {sidebarLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                collapsed && "justify-center px-2",
                isActive(link.href)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
              title={collapsed ? link.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Footer */}
      <div className={cn("p-3 space-y-3", collapsed && "p-2")}>
        {!collapsed && <LanguageSwitcher />}

        {/* User info */}
        <div className={cn(
          "flex items-center gap-2.5 px-2",
          collapsed && "justify-center px-0"
        )}>
          <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-sidebar-accent-foreground" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              {/* TODO: Replace with authenticated user name */}
              <p className="text-xs font-medium text-sidebar-foreground/80 truncate">Administrator</p>
              <p className="text-[10px] text-sidebar-foreground/40 truncate">admin@vifm.ae</p>
            </div>
          )}
        </div>

        {/* Sign out */}
        <LogoutButton variant="sidebar" />
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - desktop: collapsible, mobile: slide-over */}
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground flex flex-col border-e transition-all duration-300 ease-in-out",
          // Desktop
          "hidden lg:flex",
          collapsed ? "w-16" : "w-52"
        )}
      >
        {sidebarContent}
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center py-2 text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 w-52 bg-sidebar text-sidebar-foreground flex flex-col border-e transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Close button */}
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
        {sidebarContent}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 border-b bg-card px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <VifmLogo variant="color" size="sm" />
        </div>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
