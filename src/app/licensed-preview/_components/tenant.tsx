"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  buildSampleTenant,
  SECTOR_LABEL,
  REGION_LABEL,
  SECTOR_PROFILE,
  type Brand,
  type ModuleStat,
} from "@/lib/licensed-preview/sample-data";
import {
  PREVIEW_MODULES,
  MODULE_GROUPS,
  moduleById,
  type PreviewModule,
} from "@/lib/licensed-preview/modules";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Award,
  Activity,
  BookOpen,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

// ── helpers ──
const scoreTone = (s: number): string => (s >= 75 ? "#16a34a" : s >= 58 ? "#d97706" : "#dc2626");
const initials = (org: string) =>
  org
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "C";

function Stat({ label, value, sub, icon: Icon, accent }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${accent}15`, color: accent }}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, max = 100, accent }: { label: string; value: number; max?: number; accent: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-44 shrink-0 truncate text-sm text-slate-600">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
      </div>
      <span className="w-9 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-700">{value}</span>
    </div>
  );
}

function Gauge({ score, accent }: { score: number; accent: string }) {
  return (
    <div
      className="relative flex h-36 w-36 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${accent} ${score * 3.6}deg, #e8edf3 0deg)` }}
    >
      <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <span className="text-3xl font-bold text-slate-900">{score}</span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">readiness</span>
      </div>
    </div>
  );
}

function TrendPill({ trend }: { trend: number }) {
  const up = trend >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? "+" : ""}
      {trend} pts
    </span>
  );
}

const LOOP = [
  { label: "Diagnose", caption: "7 instruments" },
  { label: "Acquire", caption: "Pre-Hire" },
  { label: "Develop", caption: "Academy" },
  { label: "Certify", caption: "Credentials" },
  { label: "Succeed", caption: "Succession" },
];

export function Tenant({ brand, shareMode = false }: { brand: Brand; shareMode?: boolean }) {
  const data = useMemo(() => buildSampleTenant(brand), [brand]);
  const [activeId, setActiveId] = useState("command");
  const accent = brand.accent;
  const active = moduleById(activeId)!;

  // Selected services scope the portal. When the launcher picks specific services,
  // the tenant shows ONLY those (plus the Command HQ) - it is the client's licence,
  // not the whole catalogue. With no selection, the full platform is shown.
  const featured = (brand.featured ?? [])
    .map(moduleById)
    .filter((m): m is PreviewModule => !!m && m.id !== "command");
  const featuredIds = new Set(featured.map((m) => m.id));
  const scoped = featured.length > 0;
  const navGroups: { key: string; label: string; caption: string; mods: PreviewModule[] }[] = [
    { key: "command", label: "Command", caption: "Your HQ", mods: PREVIEW_MODULES.filter((m) => m.group === "command") },
    ...(scoped
      ? [{ key: "services", label: "Services", caption: "In this licence", mods: featured }]
      : MODULE_GROUPS.filter((g) => g.key !== "command").map((g) => ({
          key: g.key,
          label: g.label,
          caption: g.caption,
          mods: PREVIEW_MODULES.filter((m) => m.group === g.key),
        }))),
  ].filter((g) => g.mods.length > 0);

  return (
    <div className="fixed inset-0 z-[80] flex h-screen flex-col bg-slate-50 text-slate-900">
      {/* ── Brand header ── */}
      <header className="flex items-center justify-between gap-4 bg-[#010131] px-5 py-3 text-white">
        <div className="flex items-center gap-3">
          {brand.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logo} alt={brand.org} className="h-9 w-auto max-w-[150px] rounded-md bg-white/95 object-contain p-1" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold" style={{ background: accent }}>
              {initials(brand.org)}
            </span>
          )}
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Caliber for</span>
            </div>
            <div className="text-base font-bold">{brand.org}</div>
          </div>
          <div className="ml-2 hidden items-center gap-1.5 sm:flex">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">{SECTOR_LABEL[brand.sector]}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">{REGION_LABEL[brand.region]}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300 md:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5" /> Licensed preview · sample data
          </span>
          {shareMode ? (
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">Powered by Caliber</span>
          ) : (
            <Link href="/admin/licensed-preview" className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20">
              <ArrowLeft className="h-3.5 w-3.5" /> Exit preview
            </Link>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── Module nav ── */}
        <nav className="w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-3 py-4">
          {navGroups.map((g) => {
            return (
              <div key={g.key} className="mb-4">
                <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {g.label} <span className="font-medium text-slate-300">· {g.caption}</span>
                </div>
                {g.mods.map((m) => {
                  const on = m.id === activeId;
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setActiveId(m.id)}
                      className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition ${on ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ background: on ? m.tone : `${m.tone}15`, color: on ? "#fff" : m.tone }}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* ── Content ── */}
        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          {activeId === "command" ? (
            <CommandCenter brand={brand} data={data} accent={accent} onOpen={setActiveId} featuredIds={featuredIds} scoped={scoped} />
          ) : (
            <ModuleView module={active} stat={data.modules[active.id]} departments={data.departments} />
          )}
          <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-slate-400">
            This is a licensed-portal preview for {brand.org}. All figures are representative sample data generated for
            demonstration - no live records are shown. A production licence runs on your own secured tenant.
          </p>
        </main>
      </div>
    </div>
  );
}

// ── Command Center ──
function CommandCenter({
  brand,
  data,
  accent,
  onOpen,
  featuredIds,
  scoped,
}: {
  brand: Brand;
  data: ReturnType<typeof buildSampleTenant>;
  accent: string;
  onOpen: (id: string) => void;
  featuredIds: Set<string>;
  scoped: boolean;
}) {
  const profile = SECTOR_PROFILE[brand.sector];
  // When the licence is scoped to selected services, the capability grid shows
  // only those; otherwise the whole platform, featured-first.
  const caps = [...PREVIEW_MODULES.filter((m) => m.id !== "command" && (!scoped || featuredIds.has(m.id)))].sort(
    (a, b) => (featuredIds.has(b.id) ? 1 : 0) - (featuredIds.has(a.id) ? 1 : 0),
  );
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>{profile.headline}</div>
        <h1 className="text-2xl font-bold text-slate-900">{brand.org} · Talent Intelligence</h1>
        <p className="mt-1 text-sm text-slate-500">{profile.tagline}</p>
      </div>

      {/* Hero */}
      <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
        <div className="flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Gauge score={data.workforceReadiness} accent={accent} />
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Workforce readiness</div>
            <div className="text-sm text-slate-600">
              Composite across {data.departments.length} departments and {caps.length} instrument{caps.length === 1 ? "" : "s"}.
            </div>
            <div className="pt-1 text-sm font-semibold" style={{ color: scoreTone(data.workforceReadiness) }}>
              {data.workforceReadiness >= 75 ? "Strong" : data.workforceReadiness >= 58 ? "Developing" : "At risk"} ·
              tracked cycle-over-cycle
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Workforce" value={data.headcount.toLocaleString()} sub="employees in tenant" icon={Users} accent={accent} />
          <Stat label="Assessments run" value={data.assessmentsRun.toLocaleString()} sub="this licence year" icon={Activity} accent={accent} />
          <Stat label="Credentials" value={data.credentialsIssued.toLocaleString()} sub="verifiable, issued" icon={Award} accent={accent} />
          <Stat label="Programmes" value={String(data.programmesActive)} sub="active learning paths" icon={BookOpen} accent={accent} />
        </div>
      </div>

      {/* Caliber loop - the whole-platform methodology strip; hidden when the
          licence is scoped to specific services (it names modules not in scope). */}
      {!scoped && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-slate-900">The Caliber loop · diagnose → develop → certify</div>
          <div className="flex flex-wrap items-center gap-2">
            {LOOP.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2">
                <div className="rounded-xl border border-slate-200 px-3 py-2 text-center">
                  <div className="text-sm font-semibold text-slate-800">{s.label}</div>
                  <div className="text-[11px] text-slate-500">{s.caption}</div>
                </div>
                {i < LOOP.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Licensed capabilities */}
      <div>
        <div className="mb-3 text-sm font-semibold text-slate-900">Your licensed capabilities</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {caps.map((m) => {
            const s = data.modules[m.id];
            const Icon = m.icon;
            const isFeatured = featuredIds.has(m.id);
            return (
              <button
                key={m.id}
                onClick={() => onOpen(m.id)}
                className={`group rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow ${isFeatured ? "border-2" : "border border-slate-200 hover:border-slate-300"}`}
                style={isFeatured ? { borderColor: m.tone } : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${m.tone}15`, color: m.tone }}>
                    <Icon className="h-5 w-5" />
                  </span>
                  {isFeatured ? (
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: m.tone }}>Featured</span>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
                  )}
                </div>
                <div className="mt-2.5 text-sm font-semibold text-slate-900">{m.label}</div>
                <div className="text-xs text-slate-500">{m.tagline}</div>
                <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                  <span className="text-slate-500">{s.assessed.toLocaleString()} assessed</span>
                  <span className="font-semibold" style={{ color: scoreTone(s.avgScore) }}>{s.avgScore} avg</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Department readiness + top talent */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-slate-900">Readiness by department</div>
          <div className="space-y-2.5">
            {data.departments.map((d) => (
              <BarRow key={d.name} label={d.name} value={d.readiness} accent={accent} />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-slate-900">Top talent · ready now</div>
          <div className="divide-y divide-slate-100">
            {data.people.slice(0, 7).map((p) => (
              <div key={p.name} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-800">{p.name}</div>
                  <div className="truncate text-xs text-slate-500">{p.role} · {p.department}</div>
                </div>
                <span className="ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: scoreTone(p.readiness) }}>
                  {p.readiness}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Generic module dashboard ──
function ModuleView({
  module: m,
  stat: s,
  departments,
}: {
  module: PreviewModule;
  stat: ModuleStat;
  departments: { name: string; readiness: number }[];
}) {
  const Icon = m.icon;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Module hero */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1.5" style={{ background: m.tone }} />
        <div className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `${m.tone}15`, color: m.tone }}>
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{m.label}</h1>
            <p className="text-sm text-slate-500">{m.tagline}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Assessed" value={s.assessed.toLocaleString()} sub="people to date" icon={Users} accent={m.tone} />
        <Stat label={m.metricLabel} value={`${s.avgScore}`} sub={s.band} icon={Activity} accent={m.tone} />
        <Stat label="Coverage" value={`${s.coverage}%`} sub="of workforce" icon={ShieldCheck} accent={m.tone} />
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Cycle trend</div>
          <div className="mt-2"><TrendPill trend={s.trend} /></div>
          <div className="mt-1 text-xs text-slate-500">vs prior cycle</div>
        </div>
      </div>

      {/* Cohorts + strengths/gaps */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-slate-900">Scores by cohort</div>
          <div className="space-y-2.5">
            {s.cohorts.map((c) => (
              <BarRow key={c.name} label={`${c.name} (${c.size})`} value={c.score} accent={m.tone} />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Top strength</div>
            <div className="mt-1 text-lg font-bold text-emerald-900">{s.topStrength}</div>
            <p className="mt-1 text-sm text-emerald-700/80">Consistently strong across the assessed population.</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Priority gap</div>
            <div className="mt-1 text-lg font-bold text-amber-900">{s.topGap}</div>
            <p className="mt-1 text-sm text-amber-700/80">Recommended for targeted Academy programmes this cycle.</p>
          </div>
        </div>
      </div>

      {/* Department coverage strip */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 text-sm font-semibold text-slate-900">Where this lands across the organisation</div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {departments.slice(0, 6).map((d) => (
            <BarRow key={d.name} label={d.name} value={d.readiness} accent={m.tone} />
          ))}
        </div>
      </div>
    </div>
  );
}
