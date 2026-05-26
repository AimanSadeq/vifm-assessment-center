import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ARA_INDIVIDUAL_FACTORS } from "@/lib/constants/ara-individual-factors";
import { createDeepDivePersonalAssessment } from "./actions";
import { DeepDiveForm } from "./_components/deep-dive-form";

export const dynamic = "force-dynamic";

export default function PersonalDeepDiveNewPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link
          href="/ara/consultant"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3 w-3" /> Back to consultant dashboard
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-accent" />
            Issue a Personal Deep-Dive
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            48-item, research-grade individual AI readiness assessment for a
            paying HR client&apos;s named employee. ~10 minutes for the
            respondent. Each of the four VIFM factors gets 12 items -
            roughly double the reliability of the free 24-item snapshot.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What gets measured</CardTitle>
            <CardDescription>
              Four VIFM factors mapped to the AC behavioural framework.
              The deep-dive includes the snapshot items plus 6 additional
              items per factor that probe sub-facets the snapshot can&apos;t
              sample.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {ARA_INDIVIDUAL_FACTORS.map((f) => (
              <div key={f.id} className="rounded-md border p-2.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: f.color }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {f.domain}
                  </span>
                  <span className="ms-auto text-[10px] text-muted-foreground tabular-nums">
                    12 items
                  </span>
                </div>
                <p className="text-sm font-semibold">{f.name_en}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issue access link</CardTitle>
            <CardDescription>
              On submit, we create the assessment, generate a respondent
              access URL, and return the magic link so you can copy it
              into the email or invite that fits your client&apos;s workflow.
              The 16-min reminder cadence and other respondent
              affordances (auto-save, language toggle) are inherited from
              the standard respondent flow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeepDiveForm action={createDeepDivePersonalAssessment} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
