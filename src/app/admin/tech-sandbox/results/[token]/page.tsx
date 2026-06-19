import { notFound, redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { getSessionReport } from "@/lib/technical-sandbox/service";
import { proficiencyTierMeaning } from "@/lib/competencies/proficiency-tier";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

// Admin / client-facing on-screen results for a completed technical sitting.
// This is the development report (definitions + per-category/subcategory bands +
// narrative). It is deliberately NOT reachable by the candidate - it lives under
// the admin-gated /admin namespace and the candidate runner only ever shows a
// completion confirmation.

const bandClass = (b: string) =>
  b === "advanced"
    ? "bg-emerald-100 text-emerald-800"
    : b === "intermediate"
      ? "bg-sky-100 text-sky-800"
      : "bg-orange-100 text-orange-800";
const bandLabel = (b: string) => b.charAt(0).toUpperCase() + b.slice(1);

function Badge({ band }: { band: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${bandClass(band)}`}>
      {bandLabel(band)}
    </span>
  );
}

export default async function TechResultsPage({ params }: { params: { token: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }

  const r = await getSessionReport(params.token);
  if (!r) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <BackLink href="/admin/tech-sandbox/results" label="All results" history />

      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#5391D5]">
          VIFM · Technical {r.talentLens === "acquisition" ? "acquisition" : "development"} report
        </p>
        <h1 className="text-2xl font-semibold text-[#010131]">
          {r.nodeId ? `${r.nodeId} · ` : ""}
          {r.functionName}
        </h1>
        {r.assessmentTitle ? (
          <p className="text-sm font-medium text-[#121232]">{r.assessmentTitle}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {r.candidateName ?? "Candidate"}
          {r.candidateEmail ? ` · ${r.candidateEmail}` : ""}
          {r.organizationName ? ` · ${r.organizationName}` : ""}
          {r.submittedAt ? ` · Completed ${new Date(r.submittedAt).toLocaleString()}` : ""}
        </p>
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Development report for the client / reviewing manager. It explains what was assessed and
          where to focus development - it is not a pass/fail or hiring decision, and is not shown to
          the candidate.
        </p>
      </header>

      {r.narrativeEn ? (
        <section className="rounded-lg border bg-[#f5f8fc] p-4">
          <h2 className="mb-1 text-sm font-semibold text-[#010131]">Performance summary</h2>
          <p className="text-sm text-[#121232]">{r.narrativeEn}</p>
        </section>
      ) : null}

      <section className="flex items-center justify-between rounded-lg border bg-card p-4">
        <div>
          <p className="text-xs text-muted-foreground">Overall</p>
          <p className="text-3xl font-semibold text-[#010131]">{r.overallPct}%</p>
        </div>
        <Badge band={r.overallBand} />
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#010131]">
          Proficiency bands
        </h2>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-2 text-[#121232]">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />
            Basic &lt; 60%
          </span>
          <span className="flex items-center gap-2 text-[#121232]">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" />
            Intermediate 60-84%
          </span>
          <span className="flex items-center gap-2 text-[#121232]">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />
            Advanced &ge; 85%
          </span>
        </div>
        {/* SD-7 ask (c): what each band MEANS, not just the threshold. */}
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          <li><span className="font-semibold text-orange-700">Basic</span> - {proficiencyTierMeaning("basic", "en")}</li>
          <li><span className="font-semibold text-sky-700">Intermediate</span> - {proficiencyTierMeaning("intermediate", "en")}</li>
          <li><span className="font-semibold text-emerald-700">Advanced</span> - {proficiencyTierMeaning("advanced", "en")}</li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          How to read: each category and subcategory below is scored 0-100% and banded against these
          three thresholds.
        </p>
      </section>

      {r.knowledgeSkills.length > 0 ? (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold text-[#5391D5]">
            KNOWLEDGE BY SUBCATEGORY
            {r.knowledgePct != null ? ` · ${r.knowledgePct}% overall` : ""}
          </h2>
          <ul className="mt-2 divide-y">
            {r.knowledgeSkills.map((k) => (
              <li key={k.skill} className="flex items-center justify-between py-2 text-sm">
                <span className="text-[#121232]">{k.skill}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums text-muted-foreground">{k.scorePct}%</span>
                  <Badge band={k.band} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {r.pillars.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[#5391D5]">HANDS-ON TASKS BY CATEGORY</h2>
          {r.pillars.map((p) => (
            <div key={p.nameEn} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-[#010131]">{p.nameEn}</h3>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.advancedCount} adv · {p.intermediateCount} int · {p.basicCount} basic
                </span>
              </div>
              {p.descriptionEn ? (
                <p className="mt-1 text-xs text-muted-foreground">{p.descriptionEn}</p>
              ) : null}
              {p.developmentFocusEn ? (
                <p className="mt-1 text-xs text-[#5391D5]">Development focus: {p.developmentFocusEn}</p>
              ) : null}
              <div className="mt-3 space-y-2">
                {p.blocks.map((b) => (
                  <div key={b.nameEn} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[#121232]">{b.nameEn}</span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums text-xs text-muted-foreground">{b.scorePct}%</span>
                        <Badge band={b.band} />
                      </span>
                    </div>
                    {b.descriptionEn ? (
                      <p className="mt-1 text-xs text-muted-foreground">{b.descriptionEn}</p>
                    ) : null}
                    {b.frameworkRef ? (
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {b.frameworkRef}
                      </p>
                    ) : null}
                    {b.checkpoints.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {b.checkpoints.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <span className={c.passed ? "font-semibold text-emerald-700" : "font-semibold text-orange-700"}>
                              {c.passed ? "PASS" : "MISS"}
                            </span>
                            <span className="text-[#121232]">{c.label}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {b.developmentNoteEn ? (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {b.developmentNoteEn}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {r.recommendedCourses.length > 0 ? (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold text-[#5391D5]">RECOMMENDED VIFM ACADEMY PROGRAMMES</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Suggested development programmes from the VIFM training catalogue, matched to this
            assessment&apos;s domain and the candidate&apos;s development areas.
          </p>
          <ul className="mt-3 space-y-2">
            {r.recommendedCourses.map((c) => (
              <li key={c.courseId} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-[#121232]">
                    {c.code ? `${c.code} · ` : ""}
                    {c.titleEn}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {c.level} · {c.durationLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{c.reasonEn}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex gap-3">
        <a
          href={`/api/tech-sandbox/${params.token}/report`}
          className="rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Download PDF report
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        To deliver to the client, download the PDF and send it, or share this page with authorised
        VIFM staff. (Automatic delivery to a client recipient is a planned enhancement.)
      </p>
    </div>
  );
}
