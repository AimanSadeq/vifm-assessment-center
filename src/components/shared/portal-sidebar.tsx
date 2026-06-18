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
  FileClock,
  Network,
  type LucideIcon,
} from "lucide-react";

// `match` is the pathname used for active-state + de-dup; it defaults to `href`.
// Links whose href carries a query string (e.g. /ara?lens=acquisition) set it to
// the plain pathname so active-highlighting (usePathname strips the query) and
// the collapsed rail's de-dup behave exactly as they did before the query string.
type NavLeaf = { href: string; labelKey: string; icon: LucideIcon; exact?: boolean; match?: string };
type NavEntry = { kind: "link"; link: NavLeaf } | { kind: "group"; group: NavGroup };
type NavGroup = { key: string; label: string; icon: LucideIcon; items: NavEntry[] };

const link = (href: string, labelKey: string, icon: LucideIcon, exact?: boolean, match?: string): NavEntry => ({
  kind: "link",
  link: { href, labelKey, icon, ...(exact ? { exact } : {}), ...(match ? { match } : {}) },
});

// A self-serve instrument (Fluent / Cognitive / Persona) exposes the same
// management surfaces - runner, cohort report, vouchers, retention (+ Fluent's
// calibration). Group them so every admin surface is reachable from the sidebar,
// not just via the runner page's chips. `key` must be unique per pillar section.
const instrumentGroup = (
  key: string,
  label: string,
  icon: LucideIcon,
  base: string,
  opts?: { calibration?: boolean },
): NavEntry => ({
  kind: "group",
  group: {
    key,
    label,
    icon,
    items: [
      link(base, "adminNav.svcOverview", LayoutDashboard, true),
      link(`${base}/cohort`, "adminNav.svcCohort", Users),
      link(`${base}/vouchers`, "adminNav.svcVouchers", Ticket),
      ...(opts?.calibration ? [link(`${base}/calibration`, "adminNav.svcCalibration", SlidersHorizontal)] : []),
      link(`${base}/retention`, "adminNav.svcRetention", FileClock),
    ],
  },
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
      // Every service used FOR SELECTION. The three dual-purpose diagnostics
      // (Assessment Center, AI Readiness, Technical Assessment) lead - they also
      // appear under Talent Management for development, mirroring the landing.
      items: [
        {
          kind: "group",
          group: {
            key: "ac-acq",
            label: "Assessment Center",
            icon: ClipboardCheck,
            items: [
              link("/admin", "adminNav.dashboard", LayoutDashboard, true),
              link("/admin/engagements", "adminNav.projects", ClipboardList),
              link("/admin/exercises", "adminNav.exercises", Target),
              link("/admin/assessors", "adminNav.assessors", Users),
              link("/admin/analytics", "adminNav.analytics", BarChart3),
              link("/admin/ac-evidence", "adminNav.acEvidence", ShieldCheck),
              link("/admin/engagements/retention", "adminNav.svcRetention", FileClock),
            ],
          },
        },
        // Talent lens captured from the launching pillar (migration 00134):
        // the Acquisition pillar's ARC link tags new runs as a hiring lens.
        link("/ara?lens=acquisition", "adminNav.aiReadiness", Sparkles, undefined, "/ara"),
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
              link("/admin/tech-assessment/retention", "adminNav.svcRetention", FileClock),
            ],
          },
        },
        instrumentGroup("cognitive-acq", "Cognitive", BrainCircuit, "/ac/cognitive"),
        instrumentGroup("persona-acq", "Persona", Layers, "/ac/persona"),
        {
          kind: "group",
          group: {
            key: "prehire-acq",
            label: "Pre-Hire",
            icon: UserSearch,
            items: [
              link("/admin/prehire", "adminNav.svcOverview", LayoutDashboard, true),
              link("/admin/prehire/retention", "adminNav.svcRetention", FileClock),
            ],
          },
        },
        instrumentGroup("fluent-acq", "Fluent", Languages, "/ac/fluent", { calibration: true }),
      ],
    },
  },
  {
    kind: "group",
    group: {
      key: "manage",
      label: "Talent Management",
      icon: Sprout,
      // Every service used FOR DEVELOPMENT. The three dual-purpose diagnostics
      // lead here too (Assessment Center shown as "Development Center"), then the
      // development-only services.
      items: [
        {
          kind: "group",
          group: {
            key: "ac",
            label: "Development Center",
            icon: ClipboardCheck,
            items: [
              link("/admin", "adminNav.dashboard", LayoutDashboard, true),
              link("/admin/engagements", "adminNav.projects", ClipboardList),
              link("/admin/exercises", "adminNav.exercises", Target),
              link("/admin/assessors", "adminNav.assessors", Users),
              link("/admin/analytics", "adminNav.analytics", BarChart3),
              link("/admin/ac-evidence", "adminNav.acEvidence", ShieldCheck),
              link("/admin/engagements/retention", "adminNav.svcRetention", FileClock),
            ],
          },
        },
        // Talent lens captured from the launching pillar (migration 00134):
        // the Management pillar's ARC link tags new runs as a development lens.
        link("/ara?lens=development", "adminNav.aiReadiness", Sparkles, undefined, "/ara"),
        {
          kind: "group",
          group: {
            key: "technical-mng",
            label: "Technical Assessment",
            icon: BadgeCheck,
            items: [
              link("/admin/tech-sandbox", "adminNav.techOverview", LayoutDashboard, true),
              link("/admin/vouchers?service=technical", "adminNav.techVouchers", Award),
              link("/admin/tech-sandbox/answers", "adminNav.techAnswers", ListChecks),
              link("/admin/tech-assessment/retention", "adminNav.svcRetention", FileClock),
            ],
          },
        },
        instrumentGroup("cognitive-mng", "Cognitive", BrainCircuit, "/ac/cognitive"),
        instrumentGroup("persona-mng", "Persona", Layers, "/ac/persona"),
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
        link("/admin/framework", "adminNav.framework", Network),
        link("/admin/role-profiles", "adminNav.roleProfiles", Briefcase),
        link("/admin/vouchers", "adminNav.vouchers", Ticket),
        link("/admin/evidence-map", "adminNav.evidenceMap", FlaskConical),
        link("/admin/psychometrics", "adminNav.psychometricsBank", ListChecks),
      ],
    },
  },
  link("/admin/settings", "adminNav.settings", Settings),
];

/**
 * All leaf links, flattened depth-first and de-duped by href — for the collapsed
 * icon rail. Dual-purpose services (e.g. /admin, /ara, /admin/tech-sandbox) are
 * listed under both pillars, so the rail would otherwise show duplicate icons /
 * collide on the React key.
 */
function collectLeaves(entries: NavEntry[]): NavLeaf[] {
  const seen = new Set<string>();
  const out: NavLeaf[] = [];
  const walk = (es: NavEntry[]) => {
    for (const e of es) {
      if (e.kind === "link") {
        const key = e.link.match ?? e.link.href;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(e.link);
        }
      } else {
        walk(e.group.items);
      }
    }
  };
  walk(entries);
  return out;
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
  // Pillars + Platform open by default; the nested service groups collapse so
  // each pillar reads as a clean list of services. The group containing the
  // current route auto-expands so the active page stays visible.
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const st: Record<string, boolean> = {
      acquire: true, manage: true, platform: true,
      "ac-acq": false, ac: false, technical: false, "technical-mng": false, readiness: false,
    };
    const openActive = (entries: NavEntry[]) => {
      for (const e of entries) {
        if (e.kind !== "group") continue;
        const hasActiveLeaf = e.group.items.some(
          (it) => {
            if (it.kind !== "link") return false;
            const target = it.link.match ?? it.link.href;
            return it.link.exact ? pathname === target : pathname.startsWith(target);
          },
        );
        if (hasActiveLeaf) st[e.group.key] = true;
        openActive(e.group.items);
      }
    };
    openActive(NAV);
    return st;
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
    const active = isActive(l.match ?? l.href, l.exact);
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
    items.some((it) => (it.kind === "link" ? isActive(it.link.match ?? it.link.href, it.link.exact) : anyActiveIn(it.group.items)));

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
