import { notFound } from "next/navigation";
import { Microscope, Download, BookOpen, FileText } from "lucide-react";
import Link from "next/link";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { METHODOLOGY_BRIEFS } from "@/lib/reports/methodology-briefs-registry";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scientific Models · VIFM" };

// The report-model slugs from the shared methodology registry - the scientific
// frameworks BEHIND the generated reports (as distinct from the per-service
// methodology briefs, which live on /evidence).
const MODEL_SLUGS = ["persona-leadership", "persona-dare", "persona-eq", "persona-hipo"] as const;

// Which models have a downloadable sample report, and its route. HiPo has a
// bespoke route (it renders its own demo data + engagement); the other three
// share the generic [slug]/sample route.
const SAMPLE_REPORT_HREF: Record<string, string> = {
  "persona-hipo": "/api/admin/models/hipo-sample/pdf",
  "persona-leadership": "/api/admin/models/persona-leadership/sample/pdf",
  "persona-dare": "/api/admin/models/persona-dare/sample/pdf",
  "persona-eq": "/api/admin/models/persona-eq/sample/pdf",
};

const MODEL_DETAIL: Record<string, { measures: string }> = {
  "persona-leadership": {
    measures: "16 management + 25 leadership competencies from the VIFM 41, contrasted as two orientations with a balance read.",
  },
  "persona-dare": {
    measures: "The 41 competencies mapped to Decide (8) / Advise (10) / Recommend (8) / Execute (15) decision roles.",
  },
  "persona-eq": {
    measures: "The Goleman four quadrants (Self-Awareness, Self-Management, Social Awareness, Relationship Management) read from mapped VIFM competencies.",
  },
  "persona-hipo": {
    measures: "Aspiration (8 drive markers) x Ability (60% behavioural + 40% Logica reasoning) on a nine-grid, plus a manager-rated Engagement survey.",
  },
};

/**
 * Scientific Models hub (Platform tab): the frameworks behind the generated
 * reports - DARE, EQ, Leadership, High-Potential - each downloadable as a
 * branded PDF covering the model, the approach, and the competencies measured.
 */
export default async function ScientificModelsPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) notFound();
    throw e;
  }

  const models = MODEL_SLUGS
    .map((slug) => METHODOLOGY_BRIEFS.find((b) => b.slug === slug))
    .filter((b): b is (typeof METHODOLOGY_BRIEFS)[number] => !!b);

  return (
    <div className="space-y-6">
      <BackLink href="/admin" label="Back" history />
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#010131] text-white">
          <Microscope className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Scientific Models</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The frameworks behind the generated reports. Each PDF covers the scientific model and approach, the
            competencies and skills measured, and the honest limits - shareable with clients as-is.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {models.map((m) => (
          <div key={m.slug} className="flex flex-col rounded-xl border bg-card p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#5391D5]">{m.eyebrow}</div>
            <h2 className="mt-1 text-base font-semibold text-foreground">{m.service}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{m.tagline}</p>
            <p className="mt-2 flex-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Measures:</span> {MODEL_DETAIL[m.slug]?.measures}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`/api/methodology/${m.slug}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#010131] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#121140]"
              >
                <Download className="h-3.5 w-3.5" /> Download model PDF
              </a>
              {SAMPLE_REPORT_HREF[m.slug] && (
                <a
                  href={SAMPLE_REPORT_HREF[m.slug]}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#5391D5] px-3.5 py-2 text-xs font-semibold text-[#5391D5] transition hover:bg-[#5391D5]/10"
                >
                  <FileText className="h-3.5 w-3.5" /> View sample report
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Looking for the per-service methodology briefs (Persona, Logica, Fluent, AC, and the rest)? They live on the{" "}
        <Link href="/evidence" className="inline-flex items-center gap-1 font-semibold text-[#5391D5] hover:underline">
          <BookOpen className="h-3 w-3" /> Research &amp; validity
        </Link>{" "}
        hub.
      </p>
    </div>
  );
}
