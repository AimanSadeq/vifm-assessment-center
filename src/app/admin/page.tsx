export const dynamic = "force-dynamic";
import Link from "next/link";
import {
  Sparkles, ArrowRight, ArrowUpRight,
  ClipboardCheck, Compass, UserSearch, BadgeCheck, BrainCircuit, Layers, Languages,
  Aperture, TrendingUp, GraduationCap, Building2, Briefcase, Ticket, Network,
  Table2, BookOpen, ListChecks, Settings, LayoutGrid,
} from "lucide-react";

/**
 * Platform admin home - the front door for VIFM staff. Lands here from the
 * landing "Admin" button (and the admin-chrome logo). Shows EVERY service the
 * platform offers, grouped by pillar, instead of dropping straight into one
 * service. The Assessment Center workflow dashboard now lives at
 * /admin/assessment-center (linked below + from the sidebar's "Dashboard").
 */

type Svc = { name: string; desc: string; href: string; icon: typeof Compass; tone: string };

const ACQUIRE: Svc[] = [
  { name: "Assessment Center", desc: "Exercises, assessors, wash-up, OAR.", href: "/admin/assessment-center", icon: ClipboardCheck, tone: "text-[#5391D5]" },
  { name: "AI Readiness Compass®", desc: "Individual + org AI-readiness diagnostics.", href: "/ara?lens=acquisition", icon: Compass, tone: "text-violet-600" },
  { name: "Pre-Hire® screening", desc: "Quiz + English + AI interview, ranked.", href: "/admin/prehire", icon: UserSearch, tone: "text-rose-600" },
  { name: "Techno®", desc: "Hands-on, function-specific proficiency.", href: "/admin/tech-sandbox?lens=acquisition", icon: BadgeCheck, tone: "text-indigo-600" },
  { name: "Logical®", desc: "Indicative reasoning aptitude (psychometrics).", href: "/ac/cognitive", icon: BrainCircuit, tone: "text-emerald-600" },
  { name: "Persona®", desc: "Behavioural self-assessment across the framework.", href: "/ac/persona", icon: Layers, tone: "text-fuchsia-600" },
  { name: "Fluent® (English)", desc: "Four-skill CEFR English placement.", href: "/ac/fluent", icon: Languages, tone: "text-sky-600" },
];

const MANAGE: Svc[] = [
  { name: "Development Center", desc: "The AC run developmentally - gaps + IDP.", href: "/admin/assessment-center", icon: ClipboardCheck, tone: "text-[#5391D5]" },
  { name: "AI Readiness Compass®", desc: "Grow individual + team AI readiness.", href: "/ara?lens=development", icon: Compass, tone: "text-violet-600" },
  { name: "Reflect 360®", desc: "Multi-rater leadership feedback.", href: "/reflect", icon: Aperture, tone: "text-teal-600" },
  { name: "Succession Readiness", desc: "Persona® + 360 vs a target role.", href: "/admin/readiness", icon: TrendingUp, tone: "text-amber-600" },
  { name: "Techno®", desc: "Function skill gaps mapped to courses.", href: "/admin/tech-sandbox?lens=development", icon: BadgeCheck, tone: "text-indigo-600" },
  { name: "VIFM Academy", desc: "Training catalogue + course recommender.", href: "/admin/courses", icon: GraduationCap, tone: "text-orange-600" },
];

const PLATFORM: Svc[] = [
  { name: "Clients", desc: "Unified client registry across services.", href: "/admin/clients", icon: Building2, tone: "text-slate-600" },
  { name: "Role profiles", desc: "Reusable target-role competency packs.", href: "/admin/role-profiles", icon: Briefcase, tone: "text-cyan-700" },
  { name: "Vouchers", desc: "Issue + track redeemable access codes.", href: "/admin/vouchers", icon: Ticket, tone: "text-[#5391D5]" },
  { name: "Competency framework", desc: "The behavioural competencies + indicators.", href: "/admin/framework", icon: Network, tone: "text-fuchsia-700" },
  { name: "Compare portals", desc: "Talent Acquisition vs Talent Development.", href: "/compare", icon: Table2, tone: "text-indigo-600" },
  { name: "Research & validity", desc: "Evidence behind every instrument.", href: "/evidence", icon: BookOpen, tone: "text-emerald-700" },
  { name: "Psychometrics bank", desc: "SME item bank + calibration.", href: "/admin/psychometrics", icon: ListChecks, tone: "text-violet-700" },
  { name: "Settings", desc: "Integrations, compliance, environment.", href: "/admin/settings", icon: Settings, tone: "text-slate-600" },
];

function ServiceGrid({ title, accent, items }: { title: string; accent: string; items: Svc[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-4 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#010131]">{title}</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.name + s.href}
              href={s.href}
              className="group relative flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#5391D5]/60 hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                <Icon className={`h-5 w-5 ${s.tone}`} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#010131]">{s.name}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{s.desc}</p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-all group-hover:text-[#5391D5] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function AdminHomePage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="ara-hero relative overflow-hidden rounded-2xl">
        <div className="relative z-10 px-6 py-8 sm:px-8 sm:py-10">
          <span className="ara-eyebrow text-accent">
            <Sparkles className="h-3 w-3" /> VIFM Platform · Admin
          </span>
          <h1 className="ara-numeral mt-3 mb-2 max-w-2xl text-2xl font-semibold leading-[1.1] text-white sm:text-3xl">
            Every VIFM service, in one place
          </h1>
          <p className="max-w-2xl text-sm text-white/75">
            Your admin home across the platform. Pick a service to run it, or jump to the workflow dashboard
            for the Assessment Center.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Link
              href="/admin/assessment-center"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur transition-colors hover:border-white/40 hover:bg-white/15"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Assessment Center dashboard
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-white/70 transition-colors hover:text-white"
            >
              All services launcher <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      <ServiceGrid title="Talent Acquisition" accent="#5391D5" items={ACQUIRE} />
      <ServiceGrid title="Talent Management" accent="#059669" items={MANAGE} />
      <ServiceGrid title="Platform" accent="#7c3aed" items={PLATFORM} />
    </div>
  );
}
