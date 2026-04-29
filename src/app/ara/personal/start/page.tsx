import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, Compass } from "lucide-react";
import { startPersonalAssessmentAction } from "./actions";
import { ARA_INDIVIDUAL_FACTORS } from "@/lib/constants/ara-individual-factors";
import { StartForm } from "./_components/start-form";

export const dynamic = "force-dynamic";

export default function PersonalAssessmentStartPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Compass className="h-7 w-7 text-accent" />
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Personal AI Readiness Snapshot
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
            A short self-assessment — about 5-7 minutes — that gives you a
            clear read on how AI-ready you personally are across four
            VIFM factors. Complimentary. No account required.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What you&apos;ll get</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {ARA_INDIVIDUAL_FACTORS.map((f) => (
              <div key={f.id} className="rounded-md border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: f.color }}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {f.domain}
                  </span>
                </div>
                <p className="text-sm font-semibold">{f.name_en}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {f.description_en.slice(0, 110)}…
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Start your snapshot</CardTitle>
            <CardDescription>
              Your answers are private. Email is used only to send your
              personal results link — we don&apos;t market to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StartForm action={startPersonalAssessmentAction} />
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground text-center mt-6">
          The Personal Snapshot is one of three diagnostic tiers in the
          VIFM AI Readiness Compass. The org-level tiers (Department,
          Division, Enterprise) are consultant-led and run separately.
        </p>
      </div>
    </div>
  );
}
