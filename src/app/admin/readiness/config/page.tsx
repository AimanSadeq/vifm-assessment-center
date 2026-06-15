import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Info } from "lucide-react";
import { BackLink } from "@/components/shared/back-link";
import { loadGlobalReadinessConfig } from "@/lib/scoring/readiness-data";
import { ReadinessConfigForm } from "./_components/config-form";

export const dynamic = "force-dynamic";

// Section 3 methodology, rendered inline so an admin sees what each control changes.
const METHODOLOGY: { n: string; title: string; body: string }[] = [
  {
    n: "1",
    title: "Coverage",
    body: "A role competency is covered when the 360 produced an Others-mean for it from at least “Min Others per competency” raters. Coverage % = covered / total role competencies. Below the coverage minimum, the result is Insufficient Data and no tier is asserted - thin data must never read as a verdict.",
  },
  {
    n: "2",
    title: "Weighted Others level",
    body: "Over covered competencies, weighted_others = Σ(others_mean × weight) / Σ(weight). Turning weighting off collapses each weight to 1 (a plain mean).",
  },
  {
    n: "3",
    title: "Gap",
    body: "weighted_target is the same weighted blend of each covered competency’s target. gap = weighted_others − weighted_target. When every target equals the role default T, the gap is simply (weighted_others − T).",
  },
  {
    n: "4",
    title: "Tier from gap",
    body: "Cutoffs descending: gap ≥ Ready Now cut → Ready Now; ≥ Ready Soon cut → Ready Soon; ≥ Developing cut → Developing; otherwise Not Ready.",
  },
  {
    n: "5",
    title: "Knockout guardrail",
    body: "If enabled, any covered competency whose priority equals the knockout priority and whose Others-mean is the knockout gap or more below its target caps the final tier at the cap tier. A strong average never fast-tracks someone failing a must-have.",
  },
  {
    n: "6",
    title: "Self vs Others (self-awareness only)",
    body: "Per competency, self_others_gap = self_mean − others_mean, flagged over-rater / under-rater / aligned, plus blind-spot and hidden-strength. This never changes the tier.",
  },
  {
    n: "7",
    title: "Optional year layer",
    body: "When enabled, the tier maps to a client-defined horizon label for stakeholder copy. It is derived from the tier, never from the maths.",
  },
];

export default async function ReadinessConfigPage() {
  const { config } = await loadGlobalReadinessConfig();

  return (
    <div className="space-y-6">
      <BackLink href="/admin" label="Back" history />
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <TrendingUp className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Succession Readiness Index</h1>
          <p className="mt-1 text-muted-foreground">
            Global default parameters for the readiness engine. Every threshold here tunes how the 360
            Others view maps to a readiness tier - without a code change.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <ReadinessConfigForm initial={config} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-accent" />
            How the Readiness Index is calculated
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {METHODOLOGY.map((m) => (
            <div key={m.n} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {m.n}
              </span>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{m.title}.</span> {m.body}
              </p>
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">
            Worked example: 5 weighted competencies, target 4, Others {"{2.0, 2.2, 2.1, 2.3, 2.0}"} - weighted_others
            ≈ 2.11, gap ≈ −1.89 → Not Ready. Raise those Others to 4+ and it returns Ready Now. Drop one
            high-priority competency to 2.8 amid strong scores and the knockout caps it at Developing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
