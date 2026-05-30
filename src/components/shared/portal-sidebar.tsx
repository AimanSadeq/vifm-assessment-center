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
  ClipboardCheck,
  Target,
  Users,
  BarChart3,
  UserSearch,
  Briefcase,
  GraduationCap,
  Settings,
  Layers,
  User,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Sparkles,
  Aperture,
  Languages,
  BadgeCheck,
  type LucideIcon,
} from "lucide-react";

type NavLeaf = { href: string; labelKey: string; icon: LucideIcon; exact?: boolean };
type NavGroup = { key: string; label: string; icon: LucideIcon; items: NavLeaf[] };
type NavEntry = { kind: "link"; link: NavLeaf } | { kind: "group"; group: NavGroup };

// The portal navigation, organised as services + grouped sections so the panel
// mirrors the launcher: each top-level entry is a service (Assessment Center,
// Pre-Hire, AR Compass, Reflect, Fluent). The Assessment Center's own sections
// nest under it; cross-cutting admin areas live under "Platform". Shared by the
// admin chrome, the mobile drawer, and the landing page's left panel.
const NAV: NavEntry[] = [
  { kind: "link", link: { href: "/", labelKey: "adminNav.allServices", icon: LayoutGrid } },
  {
    kind: "group",
    group: {
      key: "ac",
      label: "Assessment Center",
      icon: ClipboardCheck,
      items: [
        { href: "/admin", labelKey: "adminNav.dashboard", icon: LayoutDashboard, exact: true },
        { href: "/admin/engagements", labelKey: "adminNav.projects", icon: ClipboardList },
        { href: "/admin/exercises", labelKey: "adminNav.exercises", icon: Target },
        { href: "/admin/assessors", labelKey: "adminNav.assessors", icon: Users },
        { href: "/admin/analytics", labelKey: "adminNav.analytics", icon: BarChart3 },
      ],
    },
  },
  { kind: "link", link: { href: "/admin/prehire", labelKey: "adminNav.preHire", icon: UserSearch } },
  { kind: "link", link: { href: "/ara", labelKey: "adminNav.aiReadiness", icon: Sparkles } },
  { kind: "link", link: { href: "/reflect", labelKey: "adminNav.reflect360", icon: Aperture } },
  { kind: "link", link: { href: "/ac/fluent", labelKey: "adminNav.fluent", icon: Languages } },
  { kind: "link", link: { href: "/admin/tech-assessment", labelKey: "adminNav.techCertification", icon: BadgeCheck } },
  {
    kind: "group",
    group: {
      key: "platform",
      label: "Platform",
      icon: Layers,
      items: [
        { href: "/admin/clients", labelKey: "adminNav.clients", icon: Building2 },
        { href: "/admin/role-profiles", labelKey: "adminNav.roleProfiles", icon: Briefcase },
        { href: "/admin/courses", labelKey: "adminNav.trainingCourses", icon: GraduationCap },
      ],
    },
  },
  { kind: "link", link: { href: "/admin/settings", labelKey: "adminNav.settings", icon: Settings } },
];

/**
 * Sidebar content (logo + nav + footer), parameterized by `collapsed`. In the
 * collapsed rail it flattens to icon-only links; expanded, it shows the
 * collapsible Assessment Center / Platform groups.
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
  const [open, setOpen] = useState<Record<string, boolean>>({ ac: true, platform: true });

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const leaf = (l: NavLeaf, indent = false) => {
    const Icon = l.icon;
    const active = isActive(l.href, l.exact);
    return (
      <Link
        key={l.href}
        href={l.href}
        onClick={onNavigate}
        title={collapsed ? t(l.labelKey) : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg py-2.5 text-sm transition-colors",
          collapsed ? "justify-center px-2" : indent ? "ps-9 pe-3" : "px-3",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{t(l.labelKey)}</span>}
      </Link>
    );
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
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {collapsed
          ? // Rail: flatten everything to icon-only links.
            NAV.flatMap((e) => (e.kind === "link" ? [e.link] : e.group.items)).map((l) => leaf(l))
          : NAV.map((e) => {
              if (e.kind === "link") return leaf(e.link);
              const g = e.group;
              const Icon = g.icon;
              const anyActive = g.items.some((it) => isActive(it.href, it.exact));
              const isOpen = open[g.key] ?? true;
              return (
                <div key={g.key}>
                  <button
                    onClick={() => setOpen((s) => ({ ...s, [g.key]: !(s[g.key] ?? true) }))}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      anyActive
                        ? "font-medium text-sidebar-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-start">{g.label}</span>
                    <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !isOpen && "-rotate-90")} />
                  </button>
                  {isOpen && <div className="mt-0.5 space-y-0.5">{g.items.map((it) => leaf(it, true))}</div>}
                </div>
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
 * The collapsible desktop sidebar (hidden below lg). Self-contained rail-collapse
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
