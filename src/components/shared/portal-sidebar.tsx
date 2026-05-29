"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { LogoutButton } from "@/components/shared/logout-button";
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
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Aperture,
  Languages,
  type LucideIcon,
} from "lucide-react";

// Single source of truth for the portal's left-panel navigation, shared by the
// admin layout (desktop + mobile) and the platform landing page so all entry
// points expose the same services + sections.
export const PORTAL_NAV_LINKS: { href: string; labelKey: string; icon: LucideIcon }[] = [
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

/**
 * The inner content of the sidebar (logo + nav + footer), parameterized by
 * `collapsed`. Reused by the collapsible desktop aside and the mobile
 * slide-over. `onNavigate` lets the mobile drawer close itself on a link click.
 */
export function SidebarBody({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
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
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {PORTAL_NAV_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
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

        <div className={cn("flex items-center gap-2.5 px-2", collapsed && "justify-center px-0")}>
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

        <LogoutButton variant="sidebar" />
      </div>
    </>
  );
}

/**
 * The collapsible desktop sidebar (hidden below lg). Self-contained collapse
 * state. Mobile drawers render <SidebarBody> directly with their own open state.
 */
export function PortalSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground flex-col border-e transition-all duration-300 ease-in-out",
        "hidden lg:flex",
        collapsed ? "w-16" : "w-52"
      )}
    >
      <SidebarBody collapsed={collapsed} />
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex items-center justify-center py-2 text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
