"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { LogoutButton } from "@/components/shared/logout-button";
import { NotificationBellClient } from "@/components/shared/notification-bell-client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  LayoutGrid,
  Building2,
  ClipboardList,
  Target,
  Users,
  BarChart3,
  UserSearch,
  Briefcase,
  GraduationCap,
  Settings,
  User,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Aperture,
  Languages,
  type LucideIcon,
} from "lucide-react";

const sidebarLinks: { href: string; labelKey: string; icon: LucideIcon }[] = [
  { href: "/", labelKey: "adminNav.allServices", icon: LayoutGrid },
  { href: "/admin", labelKey: "adminNav.dashboard", icon: LayoutDashboard },
  { href: "/admin/clients", labelKey: "adminNav.clients", icon: Building2 },
  { href: "/admin/engagements", labelKey: "adminNav.projects", icon: ClipboardList },
  { href: "/admin/role-profiles", labelKey: "adminNav.roleProfiles", icon: Briefcase },
  { href: "/admin/courses", labelKey: "adminNav.trainingCourses", icon: GraduationCap },
  { href: "/admin/exercises", labelKey: "adminNav.exercises", icon: Target },
  { href: "/admin/assessors", labelKey: "adminNav.assessors", icon: Users },
  { href: "/admin/analytics", labelKey: "adminNav.analytics", icon: BarChart3 },
  { href: "/admin/prehire", labelKey: "adminNav.preHire", icon: UserSearch },
  { href: "/ara", labelKey: "adminNav.aiReadiness", icon: Sparkles },
  { href: "/reflect", labelKey: "adminNav.reflect360", icon: Aperture },
  { href: "/ac/fluent", labelKey: "adminNav.fluent", icon: Languages },
  { href: "/admin/settings", labelKey: "adminNav.settings", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // /admin is locale-aware (see I18nProvider): the LanguageSwitcher in the
  // footer flips the whole portal to Arabic/RTL. The sidebar uses logical
  // properties (border-e, start-0, ms-auto) so it mirrors cleanly in RTL.

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
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
              title={collapsed ? t(link.labelKey) : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{t(link.labelKey)}</span>}
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
              <p className="text-xs font-medium text-sidebar-foreground/80 truncate">{t("adminNav.administrator")}</p>
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
          <div className="ms-auto">
            <NotificationBellClient />
          </div>
        </div>

        {/* Desktop top bar - just the bell, right-aligned */}
        <div className="hidden lg:flex items-center justify-end border-b bg-card px-6 py-2">
          <NotificationBellClient />
        </div>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
