"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Check, Trophy,
  ClipboardList, Users, UserCheck, Eye, GitMerge, Award, FileText,
  BookOpen, Star, FileStack, Users2,
  HandHeart, ShieldCheck,
  BarChart3, TrendingUp, LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  ClipboardList, Users, UserCheck, Eye, GitMerge, Award, FileText,
  BookOpen, Star, FileStack, Users2,
  HandHeart, ShieldCheck,
  BarChart3, TrendingUp, LayoutDashboard,
};

export type ProcessStep = {
  id: string;
  number: number;
  title: string;
  href: string;
  iconName: string;
  metric: number;
  metricLabel: string;
  isComplete: boolean;
  isActive: boolean;
};

type Props = {
  title: string;
  subtitle: string;
  steps: ProcessStep[];
  completedCount: number;
  totalSteps: number;
};

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? ClipboardList;
}

/* ── Mobile ── */
function MobileView({ steps, completedCount, totalSteps }: Omit<Props, "title" | "subtitle">) {
  const pct = Math.round((completedCount / totalSteps) * 100);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl bg-card border p-4 shadow-sm">
        <div className="relative h-12 w-12 shrink-0">
          <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
            <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--accent))" strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={`${pct * 1.257} 125.7`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{pct}%</span>
        </div>
        <div>
          <p className="text-sm font-semibold">{completedCount}/{totalSteps} Complete</p>
          <p className="text-xs text-muted-foreground">Progress tracker</p>
        </div>
      </div>
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
        <div className="space-y-3">
          {steps.map((step) => {
            const Icon = getIcon(step.iconName);
            return (
              <Link key={step.id} href={step.href} className="block group">
                <div className={cn(
                  "relative flex items-center gap-3 rounded-xl border p-3 ps-4 transition-all",
                  step.isComplete ? "bg-accent text-white shadow-sm" : step.isActive ? "bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20" : "bg-card border-border/50"
                )}>
                  <div className={cn(
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    step.isComplete ? "bg-white/20" : step.isActive ? "bg-white/20" : "bg-muted"
                  )}>
                    {step.isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    <span className={cn(
                      "absolute -top-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-bold",
                      step.isComplete ? "bg-green-500 text-white" : step.isActive ? "bg-white text-primary" : "bg-muted-foreground/20 text-muted-foreground"
                    )}>{step.isComplete ? <Check className="h-2 w-2" /> : step.number}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{step.title}</p>
                    <p className={cn("text-xs", step.isComplete ? "text-white/70" : step.isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {step.metric} {step.metricLabel}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Desktop ── */
function DesktopView({ steps, completedCount, totalSteps }: Omit<Props, "title" | "subtitle">) {
  const pct = Math.round((completedCount / totalSteps) * 100);
  const allComplete = completedCount === totalSteps;
  const N = steps.length;

  const R = N <= 4 ? 190 : N <= 6 ? 230 : 240;
  const W = R * 2 + 300;
  const H = R * 2 + 140;
  const cx = W / 2;
  const cy = H / 2;

  const nodes = steps.map((_, i) => {
    const a = (-90 + (i / N) * 360) * (Math.PI / 180);
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });

  return (
    <div className="relative mx-auto" style={{ width: W, height: H }}>
      <svg className="absolute inset-0 pointer-events-none" viewBox={`0 0 ${W} ${H}`} fill="none">
        <defs>
          <marker id="aD" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><polygon points="0 0, 10 4, 0 8" fill="hsl(var(--accent))" opacity="0.5" /></marker>
          <marker id="aP" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><polygon points="0 0, 10 4, 0 8" fill="hsl(var(--muted-foreground))" opacity="0.25" /></marker>
          <marker id="aA" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><polygon points="0 0, 10 4, 0 8" fill="hsl(var(--primary))" opacity="0.6" /></marker>
        </defs>
        {nodes.map((pos, i) => {
          const next = nodes[(i + 1) % N];
          const a1 = Math.atan2(pos.y - cy, pos.x - cx);
          const a2 = Math.atan2(next.y - cy, next.x - cx);
          const skip = 0.22;
          // Round to a fixed precision so server-rendered HTML and the
          // client re-render produce byte-identical path strings, otherwise
          // React logs a hydration mismatch warning (the trig functions
          // can produce different last-digit values between Node and the
          // browser engine).
          const round = (n: number) => n.toFixed(3);
          const sx = round(cx + R * Math.cos(a1 + skip));
          const sy = round(cy + R * Math.sin(a1 + skip));
          const ex = round(cx + R * Math.cos(a2 - skip));
          const ey = round(cy + R * Math.sin(a2 - skip));
          const isDone = steps[i].isComplete;
          const isAct = steps[i].isActive || steps[(i + 1) % N].isActive;
          return (
            <path key={`a-${i}`}
              d={`M ${sx} ${sy} A ${R} ${R} 0 0 1 ${ex} ${ey}`}
              stroke={isDone ? "hsl(var(--accent))" : isAct ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
              strokeWidth={isDone ? 3 : isAct ? 2.5 : 1.5}
              opacity={isDone ? 0.4 : isAct ? 0.5 : 0.12}
              strokeDasharray={isDone ? "none" : "6 4"}
              markerEnd={isDone ? "url(#aD)" : isAct ? "url(#aA)" : "url(#aP)"}
            />
          );
        })}
      </svg>

      {/* Hub */}
      <div className="absolute" style={{ left: cx - 70, top: cy - 70, width: 140, height: 140 }}>
        <svg className="h-full w-full -rotate-90" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r="62" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
          <circle cx="70" cy="70" r="62" fill="none" stroke="hsl(var(--accent))" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${pct * 3.896} 389.6`} className="transition-all duration-1000" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold leading-none">{pct}%</span>
          <span className="text-[9px] text-muted-foreground font-semibold tracking-widest mt-1">{completedCount}/{totalSteps} DONE</span>
          {allComplete && <Trophy className="h-4 w-4 text-green-500 mt-1" />}
        </div>
      </div>

      {/* Cards */}
      {steps.map((step, i) => {
        const { x, y } = nodes[i];
        const Icon = getIcon(step.iconName);
        const cW = 164, cH = 70;
        return (
          <Link key={step.id} href={step.href} className="absolute group z-10"
            style={{ left: x - cW / 2, top: y - cH / 2, width: cW, height: cH }}>
            <div className={cn(
              "relative flex h-full w-full items-center gap-3 rounded-xl px-3.5 transition-all duration-200 group-hover:scale-105 group-hover:shadow-xl cursor-pointer",
              step.isComplete ? "bg-accent text-white shadow-md" : step.isActive ? "bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/30" : "bg-card text-foreground border border-border shadow-sm"
            )}>
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                step.isComplete ? "bg-white/20" : step.isActive ? "bg-white/20" : "bg-muted"
              )}>
                {step.isComplete ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight">{step.title}</p>
                <p className={cn("text-[9px] mt-0.5 font-medium",
                  step.isComplete ? "text-white/70" : step.isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>{step.metric} {step.metricLabel}</p>
              </div>
              <span className={cn(
                "absolute -top-1.5 -end-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold shadow-sm",
                step.isComplete ? "bg-green-500 text-white" : step.isActive ? "bg-white text-primary border border-primary/20" : "bg-muted text-muted-foreground"
              )}>{step.isComplete ? <Check className="h-2.5 w-2.5" /> : step.number}</span>
              {step.isActive && <span className="absolute inset-0 rounded-xl border-2 border-primary animate-ping opacity-10" />}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ── Main ── */
export function ProcessMap({ title, subtitle, steps, completedCount, totalSteps }: Props) {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="lg:hidden">
        <MobileView steps={steps} completedCount={completedCount} totalSteps={totalSteps} />
      </div>
      <div className="hidden lg:block">
        <DesktopView steps={steps} completedCount={completedCount} totalSteps={totalSteps} />
      </div>
    </div>
  );
}
