import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp, Layers, Aperture, SlidersHorizontal, ClipboardList, ArrowRight, Info,
} from "lucide-react";
import { BackLink } from "@/components/shared/back-link";
import { createServiceClient } from "@/lib/supabase/server";
import { StartReadinessProgram } from "./_components/start-readiness-program";

export const dynamic = "force-dynamic";

// The two instruments Succession Readiness fuses, each its own standalone service.
const INPUTS: {
  icon: typeof Layers;
  tone: string;
  lens: string;
  name: string;
  body: string;
  href: string;
  cta: string;
}[] = [
  {
    icon: Layers,
    tone: "text-[#c026d3]",
    lens: "Self",
    name: "Persona",
    body: "The person rates themselves across the 38 competencies - the same framework as the 360. This is the self view of readiness.",
    href: "/ac/psychometrics#persona",
    cta: "Open Persona",
  },
  {
    icon: Aperture,
    tone: "text-teal-600",
    lens: "Others",
    name: "Reflect 360",
    body: "Manager, peers and direct reports rate the same competencies. This is the observed, multi-rater view of readiness.",
    href: "/reflect",
    cta: "Open Reflect 360",
  },
];

const STEPS: { n: string; title: string; body: string }[] = [
  { n: "1", title: "Pick a target role", body: "Bind the person to a role profile so the engine knows the competency targets, weights and any must-have knockouts to score against." },
  { n: "2", title: "Collect both lenses", body: "Run Persona for the person (Self) and a Reflect 360 for the same person (Others). Each instrument keeps its own standalone report." },
  { n: "3", title: "Read the verdict", body: "The engine fuses Others against the role target into a readiness tier (Ready Now / Soon / Developing / Not Ready), with gaps, blind spots and a draft development plan." },
];

/**
 * Succession Readiness service home - the front door for the combined offering
 * (Persona self + Reflect 360 others vs a target role). The scoring engine,
 * per-candidate report and IDP already exist; this page orients the user and
 * links to the inputs, the scoring config, and the engagements where the
 * readiness verdict is rendered.
 */
export default async function ReadinessHomePage() {
  const sb = createServiceClient();
  const { data: orgRows } = await sb.from("organizations").select("id, name").order("name");
  const orgs = (orgRows ?? []).map((o) => ({ id: o.id as string, name: (o.name as string) ?? "Untitled" }));

  return (
    <div className="space-y-6">
      <BackLink href="/" label="Back" history />

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <TrendingUp className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Succession Readiness</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            The combined service. It fuses <strong>Persona</strong> (the person&rsquo;s self-assessment) and a{" "}
            <strong>Reflect 360</strong> (how others rate them) against a target role, and returns a readiness
            tier, competency gaps, blind spots and a development plan.
          </p>
        </div>
      </div>

      {/* Thin front door: start a combined-mode programme without going via the AC. */}
      <StartReadinessProgram orgs={orgs} />

      {/* The two inputs, each its own standalone service */}
      <div className="grid gap-4 sm:grid-cols-2">
        {INPUTS.map((i) => {
          const Icon = i.icon;
          return (
            <Card key={i.name} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${i.tone}`} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{i.lens}</span>
                </div>
                <CardTitle className="text-base">{i.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-3">
                <p className="text-sm text-muted-foreground">{i.body}</p>
                <Link
                  href={i.href}
                  className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  {i.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-accent" />
            How a readiness run works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {s.n}
              </span>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{s.title}.</span> {s.body}
              </p>
            </div>
          ))}
          <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              One-click combined setup - standing up Persona and a Reflect 360 together against a role from a
              single button - is being wired next. For now, run the two instruments for the same person and the
              engine fuses them automatically into the readiness report.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Manage */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/engagements" className="group">
          <Card className="h-full transition-colors group-hover:border-accent">
            <CardContent className="flex items-center gap-3 p-5">
              <ClipboardList className="h-5 w-5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">View readiness on a project</p>
                <p className="text-xs text-muted-foreground">Open an engagement to see each person&rsquo;s readiness tier, gaps and IDP.</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/readiness/config" className="group">
          <Card className="h-full transition-colors group-hover:border-accent">
            <CardContent className="flex items-center gap-3 p-5">
              <SlidersHorizontal className="h-5 w-5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Scoring configuration</p>
                <p className="text-xs text-muted-foreground">Tune tier cutoffs, weighting, the knockout guardrail and confidence bands.</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
