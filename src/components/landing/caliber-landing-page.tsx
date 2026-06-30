'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import {
  ArrowRight, ShieldCheck, Sparkles, ClipboardList, Wrench, Brain, UserCircle,
  Languages, UserSearch, RefreshCw, TrendingUp, GraduationCap, Layers, BadgeCheck, Bot, Globe2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DemoRequestDialog } from './demo-request-dialog'

const HERO_BG = 'linear-gradient(160deg, #010131 0%, #0a0a3a 55%, #1a1248 100%)'
const DOT_GRID = 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)'
const ACCENT_FROM = '#a78bfa'
const ACCENT_TO = '#c4b5fd'
const LOGO = '/images/vifm-logo-light.png'

const STATS = [
  { value: '10', label: 'Assessment services' },
  { value: '41', label: 'Competencies measured' },
  { value: '100+', label: 'Training programmes' },
]

type Family = 'selection' | 'development'
type DiagramKind = 'matrix' | 'compass' | 'bands' | 'sequence' | 'radar' | 'cefr' | 'funnel' | 'threesixty' | 'tiers' | 'academy'
interface Product { icon: typeof Sparkles; category: string; name: string; desc: string; families: Family[]; diagram: DiagramKind }

const PRODUCTS: Product[] = [
  { icon: ClipboardList, category: 'Competency assessment', name: 'Assessment Center', desc: 'Design assessment centers, run exercises and observations, reach scoring consensus in the live wash-up engine, and issue competency reports and learning plans.', families: ['selection', 'development'], diagram: 'matrix' },
  { icon: Sparkles, category: 'AR COMPASS® diagnostic', name: 'AI Readiness', desc: 'An eight-pillar organisational AI-readiness diagnostic, calibrated for the GCC, with bilingual board-ready reports and a complimentary personal snapshot.', families: ['selection', 'development'], diagram: 'compass' },
  { icon: Wrench, category: 'Technical proficiency', name: 'Techno®', desc: 'Performance-based, function-specific assessment: candidates do real work in live sandboxes, graded against master answers and banded Basic / Intermediate / Advanced.', families: ['selection', 'development'], diagram: 'bands' },
  { icon: Brain, category: 'Reasoning aptitude', name: 'Logica®', desc: 'Indicative numerical, verbal, inductive and deductive reasoning - a foundational read on aptitude. Server-scored, admin-run and bilingual.', families: ['selection', 'development'], diagram: 'sequence' },
  { icon: UserCircle, category: 'Behavioural self-assessment', name: 'Persona®', desc: 'Self-ratings across the 41 competencies - the same framework as the 360, and the "self" view that feeds Succession Readiness.', families: ['selection', 'development'], diagram: 'radar' },
  { icon: Languages, category: 'AI English placement', name: 'Fluent®', desc: 'A four-skill, CEFR-aligned English placement: AI-generated reading and listening, rubric-scored writing and speaking, with an indicative level in minutes.', families: ['selection', 'development'], diagram: 'cefr' },
  { icon: UserSearch, category: 'Pre-employment screening', name: 'Pre-Hire®', desc: 'A configurable funnel of competency quiz, English placement and an AI behavioural interview, with a weighted composite, adverse-impact monitoring and an audit trail.', families: ['selection'], diagram: 'funnel' },
  { icon: RefreshCw, category: 'Leadership feedback', name: 'Reflect 360®', desc: '360-degree leadership feedback built from your own values and competencies, with a development plan per leader and an organisation-wide culture view.', families: ['development'], diagram: 'threesixty' },
  { icon: TrendingUp, category: 'Self + 360 vs the role', name: 'Succession Readiness', desc: 'Combines Persona (self) and a Reflect 360 (others) against a target role to produce a readiness tier, gaps, blind spots and a development plan.', families: ['development'], diagram: 'tiers' },
  { icon: GraduationCap, category: 'Learning & delivery', name: 'VIFM Academy', desc: 'Self-paced finance & management programmes that turn each diagnosis into action - AI knowledge-checks per lesson and a verifiable completion credential, in English or Arabic.', families: ['development'], diagram: 'academy' },
]

const DA = '#a78bfa', DL = '#c4b5fd', DM = 'rgba(255,255,255,0.16)'

/** Compact line-art diagram per service, in the violet accent. */
function ServiceDiagram({ kind }: { kind: DiagramKind }) {
  const svg = (children: ReactNode) => (
    <svg viewBox="0 0 120 56" className="h-16 w-full" fill="none" aria-hidden="true">{children}</svg>
  )
  switch (kind) {
    case 'matrix':
      return svg(Array.from({ length: 15 }).map((_, i) => {
        const r = Math.floor(i / 5), c = i % 5
        const on = [2, 5, 6, 8, 11, 12, 14].includes(i)
        return <circle key={i} cx={16 + c * 22} cy={12 + r * 16} r="3.4" fill={on ? DA : DM} />
      }))
    case 'compass':
      return svg(
        <g transform="translate(60,28)">
          {Array.from({ length: 8 }).map((_, i) => {
            const ang = (i / 8) * Math.PI * 2
            const len = [18, 12, 20, 14, 17, 11, 19, 13][i]
            const x = Math.cos(ang) * len, y = Math.sin(ang) * len
            return <g key={i}><line x1="0" y1="0" x2={x} y2={y} stroke={DM} strokeWidth="1.2" /><circle cx={x} cy={y} r="2.6" fill={DA} /></g>
          })}
          <circle r="3" fill={DL} />
        </g>,
      )
    case 'bands':
      return svg(
        <g>
          <rect x="14" y="38" width="30" height="8" rx="4" fill={DM} />
          <rect x="14" y="24" width="48" height="8" rx="4" fill="rgba(167,139,250,0.5)" />
          <rect x="14" y="10" width="66" height="8" rx="4" fill={DA} />
          <circle cx="90" cy="14" r="3" fill={DL} />
        </g>,
      )
    case 'sequence':
      return svg(
        <g strokeWidth="2" fill="none">
          <circle cx="20" cy="28" r="8" stroke={DA} />
          <rect x="38" y="20" width="16" height="16" rx="2" stroke={DL} />
          <path d="M70 36 L78 20 L86 36 Z" stroke={DA} />
          <rect x="98" y="20" width="16" height="16" rx="2" stroke={DM} strokeDasharray="3 3" />
        </g>,
      )
    case 'radar':
      return svg(
        <g transform="translate(60,28)">
          <polygon points="20,0 10,17.3 -10,17.3 -20,0 -10,-17.3 10,-17.3" stroke={DM} strokeWidth="1" />
          <polygon points="14,2 6,12 -8,9 -12,-1 -5,-13 9,-9" fill="rgba(167,139,250,0.25)" stroke={DA} strokeWidth="1.5" />
        </g>,
      )
    case 'cefr':
      return svg(Array.from({ length: 6 }).map((_, i) => {
        const h = 8 + i * 6
        return <rect key={i} x={12 + i * 18} y={48 - h} width="12" height={h} rx="2" fill={i >= 4 ? DA : DM} />
      }))
    case 'funnel':
      return svg(
        <g>
          <path d="M28 8 H92 L78 22 H42 Z" fill={DM} />
          <path d="M44 26 H76 L68 38 H52 Z" fill="rgba(167,139,250,0.5)" />
          <path d="M53 42 H67 L62 52 H58 Z" fill={DA} />
        </g>,
      )
    case 'threesixty':
      return svg(
        <g transform="translate(60,28)">
          <circle r="20" stroke={DM} strokeWidth="1" strokeDasharray="2 3" />
          <circle r="7" fill="rgba(167,139,250,0.25)" stroke={DA} strokeWidth="1.5" />
          {Array.from({ length: 6 }).map((_, i) => {
            const ang = (i / 6) * Math.PI * 2 - Math.PI / 2
            return <circle key={i} cx={Math.cos(ang) * 20} cy={Math.sin(ang) * 20} r="3" fill={DL} />
          })}
        </g>,
      )
    case 'tiers':
      return svg(
        <g>
          <rect x="22" y="34" width="24" height="14" rx="2" fill={DM} />
          <rect x="50" y="24" width="24" height="24" rx="2" fill="rgba(167,139,250,0.5)" />
          <rect x="78" y="14" width="24" height="34" rx="2" fill={DA} />
          <circle cx="90" cy="9" r="3.5" fill={DL} />
        </g>,
      )
    case 'academy':
      return svg(
        <g fill="none">
          <line x1="20" y1="28" x2="64" y2="28" stroke={DM} strokeWidth="2" />
          {[20, 42, 64].map((cx, i) => (
            <g key={i}>
              <circle cx={cx} cy="28" r="7" fill={i < 2 ? 'rgba(167,139,250,0.3)' : 'none'} stroke={DA} strokeWidth="1.5" />
              {i < 2 && <path d={`M${cx - 3} 28 l2 2 l4 -4`} stroke={DL} strokeWidth="1.6" />}
            </g>
          ))}
          <circle cx="98" cy="24" r="9" fill="rgba(167,139,250,0.2)" stroke={DA} strokeWidth="1.5" />
          <path d="M93 30 l3 9 l2 -4 l2 4 l3 -9" stroke={DA} strokeWidth="1.4" />
          <path d="M94 24 l3 3 l5 -6" stroke={DL} strokeWidth="1.6" />
        </g>,
      )
  }
}

const FamilyTag = ({ f }: { f: Family }) => (
  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
    f === 'selection' ? 'bg-sky-400/15 text-sky-300' : 'bg-[#a78bfa]/15 text-[#c4b5fd]')}>
    {f === 'selection' ? 'For selection' : 'For development'}
  </span>
)

export function CaliberLandingPage() {
  const [demoOpen, setDemoOpen] = useState(false)

  return (
    <div className="min-h-dvh text-white" style={{ background: HERO_BG }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 65%)' }} />
        <div className="absolute -bottom-40 -left-40 h-[36rem] w-[36rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,123,240,0.12) 0%, transparent 65%)' }} />
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: DOT_GRID, backgroundSize: '34px 34px' }} />
      </div>

      <div className="relative">
        {/* Header - FIXED (global body overflow breaks position:sticky). */}
        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#010131]/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Image src={LOGO} alt="VIFM" width={132} height={42} className="h-9 w-auto object-contain brightness-0 invert" priority />
            <nav className="hidden items-center gap-7 text-sm text-white/70 lg:flex">
              <a href="#solutions" className="hover:text-white">Solutions</a>
              <a href="#suite" className="hover:text-white">Assessments</a>
              <a href="#academy" className="hover:text-white">Academy</a>
            </nav>
            <div className="flex items-center gap-2 sm:gap-3">
              <a href="/login" className="hidden items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 sm:flex">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin
              </a>
              <button onClick={() => setDemoOpen(true)} className="rounded-lg bg-[#8b7bf0] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#7c6ae8]">
                Request a demo
              </button>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-24 sm:px-6 lg:grid-cols-2 lg:pb-24 lg:pt-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#a78bfa]/40 bg-[#a78bfa]/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-[#c4b5fd]">
              VIFM Talent Intelligence Platform
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl">
              Build the talent the{' '}
              <span className="bg-gradient-to-r bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg, ${ACCENT_FROM}, ${ACCENT_TO})` }}>future demands</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              A finance &amp; management institute for the GCC. One platform across the full talent lifecycle - Talent Acquisition to screen and select, Talent Development to grow and retain - with bilingual assessments, verifiable credentials, and learning mapped to the gaps our diagnostics reveal.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={() => setDemoOpen(true)} className="group inline-flex items-center gap-2 rounded-xl bg-[#8b7bf0] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#8b7bf0]/20 transition-all hover:bg-[#7c6ae8]">
                Request a demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <a href="#suite" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/10">Explore the platform</a>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/50">
              <span className="inline-flex items-center gap-1.5"><Globe2 className="h-3.5 w-3.5" /> Bilingual English / Arabic</span>
              <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5" /> Verifiable credentials</span>
              <span className="inline-flex items-center gap-1.5"><Bot className="h-3.5 w-3.5" /> AI-supported learning</span>
            </div>
          </div>

          {/* Hero mock */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white/90">Talent Dashboard</p>
                <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-[#a78bfa]/70" /></div>
              </div>
              <div className="mt-4 flex items-center gap-4 rounded-xl bg-white/5 p-4">
                <div className="grid h-16 w-16 place-items-center rounded-full" style={{ background: 'conic-gradient(#a78bfa 0% 78%, rgba(255,255,255,0.12) 78% 100%)' }}>
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-[#1a1248]"><span className="text-xs font-bold">78%</span></div>
                </div>
                <div><p className="text-xs text-white/50">AI Readiness - 8 pillars</p><p className="text-lg font-bold">Advanced</p></div>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/5 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#a78bfa]/20 text-[#c4b5fd]"><Wrench className="h-4 w-4" /></div>
                <div className="min-w-0"><p className="truncate text-sm font-medium">Techno® - Financial Modelling</p><p className="truncate text-xs text-white/50">Banded: Advanced · graded vs master answers</p></div>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-4 w-64 rounded-xl border border-white/10 bg-[#1a1248] p-4 shadow-xl">
              <div className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-emerald-400" /><p className="text-xs font-semibold">Competency report issued</p></div>
              <p className="mt-1 text-xs text-white/50">Reflect 360® · development plan ready</p>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STATS.map((s, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="bg-gradient-to-r bg-clip-text text-4xl font-bold text-transparent" style={{ backgroundImage: `linear-gradient(90deg, ${ACCENT_FROM}, ${ACCENT_TO})` }}>{s.value}</p>
                <p className="mt-2 text-sm text-white/60">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Two solution families */}
        <section id="solutions" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#c4b5fd]">Two solution families</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Start with a diagnosis</h2>
          <p className="mt-4 max-w-2xl text-lg text-white/65">Two solution families cover the full talent lifecycle - pick where to focus, and the platform takes it from diagnosis to development.</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {[
              { tag: 'For selection', name: 'Talent Acquisition', desc: 'Screen, assess and select with confidence - aptitude, technical proficiency, English, behavioural and pre-hire screening, with audit-ready signals.', icon: UserSearch },
              { tag: 'For development', name: 'Talent Development', desc: 'Grow and retain - 360 feedback, succession readiness, and learning programmes mapped to the exact gaps your diagnostics reveal.', icon: TrendingUp },
            ].map((fam, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.04] p-7 transition-colors hover:border-[#a78bfa]/40">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#a78bfa]/15 text-[#c4b5fd]"><fam.icon className="h-5 w-5" /></div>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">{fam.tag}</span>
                </div>
                <h3 className="mt-4 text-xl font-bold">{fam.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{fam.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The assessment suite (tiles with diagrams) */}
        <section id="suite" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#c4b5fd]">The suite</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Ten services, one talent platform</h2>
          <p className="mt-4 max-w-2xl text-lg text-white/65">Each diagnosis flows into development - assessments and learning that share the same 41-competency framework.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((p, i) => (
              <div key={i} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:-translate-y-0.5 hover:border-[#a78bfa]/40 hover:bg-white/[0.05]">
                <div className="mb-4 flex h-16 items-center justify-center rounded-xl border border-white/5 bg-gradient-to-b from-white/[0.06] to-transparent px-4 transition-colors group-hover:border-[#a78bfa]/20">
                  <ServiceDiagram kind={p.diagram} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#a78bfa]/15 text-[#c4b5fd]"><p.icon className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">{p.category}</p>
                    <h3 className="text-base font-semibold leading-tight">{p.name}</h3>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{p.desc}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">{p.families.map((f) => <FamilyTag key={f} f={f} />)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Featured: AI Readiness */}
        <section className="border-y border-white/10 bg-[#010131]/40 py-16">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#c4b5fd]">Featured · AR COMPASS®</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">An organisational AI-readiness diagnostic, built for the GCC</h2>
              <p className="mt-4 text-lg leading-relaxed text-white/65">Eight pillars, calibrated for Saudi Arabia, the UAE and the wider GCC, with bilingual board-ready reports - plus a complimentary personal AI-readiness snapshot for every leader.</p>
              <button onClick={() => setDemoOpen(true)} className="group mt-7 inline-flex items-center gap-2 rounded-xl bg-[#8b7bf0] px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#7c6ae8]">
                See AR COMPASS® <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['Strategy', 'Data', 'Talent', 'Governance', 'Technology', 'Operations', 'Culture', 'Ethics'].map((pillar, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <Sparkles className="h-4 w-4 text-[#c4b5fd]" /><span className="text-sm font-medium">{pillar}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bespoke + Academy */}
        <section id="academy" className="mx-auto grid max-w-7xl scroll-mt-24 gap-5 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#a78bfa]/15 text-[#c4b5fd]"><Layers className="h-5 w-5" /></div>
            <h3 className="mt-4 text-xl font-bold">Bespoke services</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">Combine any of our services into a single tailored package and assign it to a client - design exactly the engagement they need.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#a78bfa]/15 text-[#c4b5fd]"><GraduationCap className="h-5 w-5" /></div>
            <h3 className="mt-4 text-xl font-bold">VIFM Academy</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">Self-paced finance &amp; management programmes that turn each diagnosis into action - AI knowledge-checks per lesson and a verifiable completion credential, in English or Arabic.</p>
          </div>
        </section>

        {/* Built for the GCC */}
        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#c4b5fd]">Built for the GCC</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-white/70">
              <span className="inline-flex items-center gap-2"><Globe2 className="h-4 w-4 text-[#c4b5fd]" /> Saudi Arabia · UAE · wider GCC</span>
              <span className="inline-flex items-center gap-2"><Languages className="h-4 w-4 text-[#c4b5fd]" /> Bilingual English / Arabic</span>
              <span className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-[#c4b5fd]" /> Verifiable credentials</span>
              <span className="inline-flex items-center gap-2"><Bot className="h-4 w-4 text-[#c4b5fd]" /> AI-supported throughout</span>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-[#a78bfa]/30 bg-gradient-to-br from-[#0a0a3a] to-[#1a1248] p-10 text-center sm:p-14">
            <div className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: DOT_GRID, backgroundSize: '28px 28px' }} />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold sm:text-4xl">Build the talent the future demands.</h2>
              <p className="mx-auto mt-4 max-w-xl text-white/70">See the full platform - assessments, readiness diagnostics and learning - in a walkthrough for your team.</p>
              <button onClick={() => setDemoOpen(true)} className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-[#8b7bf0] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#8b7bf0]/20 transition-all hover:bg-[#7c6ae8]">
                Request a demo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-[#010131]/60">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <Image src={LOGO} alt="VIFM" width={120} height={38} className="h-8 w-auto object-contain brightness-0 invert" />
              <p className="mt-3 max-w-sm text-xs text-white/50">Virginia Institute of Finance and Management · Confidential - for VIFM and engaged clients only.</p>
            </div>
            <div className="flex gap-6 text-sm text-white/50">
              <a href="/courses" className="hover:text-white/80">Training catalogue</a>
            </div>
          </div>
        </footer>
      </div>

      <DemoRequestDialog open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  )
}
