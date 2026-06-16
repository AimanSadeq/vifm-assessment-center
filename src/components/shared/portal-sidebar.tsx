"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
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
  UserPlus,
  Sprout,
  Briefcase,
  GraduationCap,
  Settings,
  Layers,
  User,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Sparkles,
  Wand2,
  Aperture,
  Languages,
  BrainCircuit,
  BadgeCheck,
  ListChecks,
  Award,
  ShieldCheck,
  FlaskConical,
  TrendingUp,
  SlidersHorizontal,
  Ticket,
  type LucideIcon,
} from "lucide-react";

type NavLeaf = { href: string; labelKey: string; icon: LucideIcon; exact?: boolean };
type NavEntry = { kind: "link"; link: NavLeaf } | { kind: "group"; group: NavGroup };
type NavGroup = { key: string; label: string; icon: LucideIcon; items: NavEntry[] };

const link = (href: string, labelKey: string, icon: LucideIcon, exact?: boolean): NavEntry => ({
  kind: "link",
  link: { href, labelKey, icon, ...(exact ? { exact } : {}) },
});

// The portal navigation, mirroring the landing launcher's two talent-lifecycle
// solution families. The two pillars are collapsible top-level groups; the
// multi-page measurement modules (Assessment Center, Technical Assessment) nest
// their own sub-sections inside the relevant pillar. Cross-cutting admin areas
// live under "Platform". Shared by the admin chrome, the mobile drawer, and the
// landing page's left panel.
const NAV: NavEntry[] = [
  link("/", "adminNav.allServices", LayoutGrid),
  link("/admin/start", "adminNav.startAssessment", Wand2),
  {
    kind: "group",
    group: {
      key: "acquire",
      label: "Talent Acquisition",
      icon: UserPlus,
      items: [
        link("/admin/prehire", "adminNav.preHire", UserSearch),
        link("/ac/fluent", "adminNav.fluent", Languages),
        {
          kind: "group",
          group: {
            key: "technical",
            label: "Technical Assessment",
            icon: BadgeCheck,
            items: [
              link("/admin/tech-sandbox", "adminNav.techOverview", LayoutDashboard, true),
              link("/admin/vouchers?service=technical", "adminNav.techVouchers", Award),
              link("/admin/tech-sandbox/answers", "adminNav.techAnswers", ListChecks),
            ],
          },
        },
        {
          kind: "group",
          group: {
            key: "psychometrics",
            label: "Psychometrics",
            icon: BrainCircuit,
            items: [
              link("/ac/psychometrics", "adminNav.psyCognitive", BrainCircuit, true),
              link("/ac/psychometrics#persona", "adminNav.psyPersona", Layers),
              link("/admin/psychometrics", "adminNav.psychometricsBank", ListChecks),
            ],
          },
        },
      ],
    },
  },
  {
    kind: "group",
    group: {
      key: "manage",
      label: "Talent Management",
      icon: Sprout,
      items: [
        {
          kind: "group",
          group: {
            key: "ac",
            label: "Assessment Center",
            icon: ClipboardCheck,
            items: [
              link("/admin", "adminNav.dashboard", LayoutDashboard, true),
              link("/admin/engagements", "adminNav.projects", ClipboardList),
              link("/admin/exercises", "adminNav.exercises", Target),
              link("/admin/assessors", "adminNav.assessors", Users),
              link("/admin/analytics", "adminNav.analytics", BarChart3),
              link("/admin/ac-evidence", "adminNav.acEvidence", ShieldCheck),
            ],
          },
        },
        link("/reflect", "adminNav.reflect360", Aperture),
        {
          kind: "group",
          group: {
            key: "readiness",
            label: "Succession Readiness",
            icon: TrendingUp,
            items: [
              link("/admin/readiness", "adminNav.readinessOverview", LayoutDashboard, true),
              link("/admin/readiness/config", "adminNav.readinessConfig", SlidersHorizontal),
            ],
          },
        },
        link("/ara", "adminNav.aiReadiness", Sparkles),
        link("/admin/courses", "adminNav.academy", GraduationCap),
      ],
    },
  },
  {
    kind: "group",
    group: {
      key: "platform",
      label: "Platform",
      icon: Layers,
      items: [
        link("/admin/clients", "adminNav.clients", Building2),
        link("/admin/role-profiles", "adminNav.roleProfiles", Briefcase),
        link("/admin/vouchers", "adminNav.vouchers", Ticket),
        link("/admin/evidence-map", "adminNav.evidenceMap", FlaskConical),
      ],
    },
  },
  link("/admin/settings", "adminNav.settings", Settings),
];

/** All leaf links, flattened depth-first — for the collapsed icon rail. */
function collectLeaves(entries: NavEntry[]): NavLeaf[] {
  return entries.flatMap((e) => (e.kind === "link" ? [e.link] : collectLeaves(e.group.items)));
}

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
  const [open, setOpen] = useState<Record<string, boolean>>({
    acquire: true, manage: true, ac: true, technical: true, psychometrics: true, readiness: true, platform: true,
  });

  // The signed-in user, for the footer identity.
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (u) {
        setMe({
          name: (u.user_metadata?.full_name as string) || u.email || "",
          email: u.email || "",
        });
      }
    });
  }, []);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  // Indentation per nesting depth (0 = top level, 1 = inside a pillar, 2 = inside
  // a nested sub-group like Assessment Center / Technical Assessment).
  const PAD = ["px-3", "ps-9 pe-3", "ps-12 pe-3"] as const;
  const pad = (depth: number) => PAD[Math.min(depth, PAD.length - 1)];

  const leaf = (l: NavLeaf, depth = 0) => {
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
          collapsed ? "justify-center px-2" : pad(depth),
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

  const anyActiveIn = (items: NavEntry[]): boolean =>
    items.some((it) => (it.kind === "link" ? isActive(it.link.href, it.link.exact) : anyActiveIn(it.group.items)));

  // Recursive: a link renders as a leaf; a group renders a collapsible header
  // plus its (possibly nested) children at the next depth.
  const renderNode = (entry: NavEntry, depth: number): ReactNode => {
    if (entry.kind === "link") return leaf(entry.link, depth);
    const g = entry.group;
    const Icon = g.icon;
    const anyActive = anyActiveIn(g.items);
    const isOpen = open[g.key] ?? true;
    return (
      <div key={g.key}>
        <button
          onClick={() => setOpen((s) => ({ ...s, [g.key]: !(s[g.key] ?? true) }))}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg py-2.5 text-sm transition-colors",
            pad(depth),
            anyActive
              ? "font-medium text-sidebar-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-start">{g.label}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !isOpen && "-rotate-90")} />
        </button>
        {isOpen && <div className="mt-0.5 space-y-0.5">{g.items.map((it) => renderNode(it, depth + 1))}</div>}
      </div>
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
          ? // Rail: flatten the whole tree to icon-only links.
            collectLeaves(NAV).map((l) => leaf(l))
          : NAV.map((e) => renderNode(e, 0))}
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
              <p className="text-xs font-medium text-sidebar-foreground/80 truncate">{me?.name || t("adminNav.administrator")}</p>
              <p className="text-[10px] text-sidebar-foreground/40 truncate">{me?.email || ""}</p>
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
