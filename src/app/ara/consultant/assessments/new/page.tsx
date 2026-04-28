import Link from "next/link";
import { ArrowLeft, Building2, Network, Globe2, Sparkles, Check, User } from "lucide-react";
import { IndividualLayerToggle } from "./_components/individual-layer-toggle";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAraAssessment } from "@/lib/ara/actions";
import { ARA_STAGE_DEFINITIONS } from "@/lib/constants/ara-stages";
import { ARA_ASSESSMENT_TEMPLATES, getAssessmentTemplate } from "@/lib/constants/ara-assessment-templates";
import type { AraEngagementStage, AraOrganization, AraQuestionBankVersion } from "@/types/ara";

export const dynamic = "force-dynamic";

const STAGE_ICONS: Record<AraEngagementStage, typeof Building2> = {
  department: Building2,
  division: Network,
  enterprise: Globe2,
  // 'individual' shouldn't normally appear in the consultant wizard
  // (it's for the self-served /ara/personal flow), but we cover the
  // type so a stage-aware route never crashes if one slips through.
  individual: User,
};

const TONE_MAP = {
  teal:   { fg: "#0D9488", bgSoft: "rgba(13, 148, 136, 0.06)", border: "rgba(13, 148, 136, 0.3)",  bgIcon: "rgba(13, 148, 136, 0.10)" },
  violet: { fg: "#7C3AED", bgSoft: "rgba(124, 58, 237, 0.04)", border: "rgba(124, 58, 237, 0.3)",  bgIcon: "rgba(124, 58, 237, 0.10)" },
  gold:   { fg: "#D97706", bgSoft: "rgba(217, 119, 6, 0.04)",  border: "rgba(217, 119, 6, 0.3)",   bgIcon: "rgba(217, 119, 6, 0.12)" },
} as const;

export default async function NewAraAssessmentPage({
  searchParams,
}: {
  searchParams?: { stage?: string; template?: string };
}) {
  const validStages = ARA_STAGE_DEFINITIONS.map((s) => s.id) as string[];
  const selectedStage = (searchParams?.stage && validStages.includes(searchParams.stage))
    ? (searchParams.stage as AraEngagementStage)
    : null;
  const selectedTemplate = searchParams?.template ? getAssessmentTemplate(searchParams.template) : undefined;

  const sb = createServiceClient();
  const [{ data: orgs }, { data: versions }] = await Promise.all([
    sb
      .from("ara_organizations")
      .select("id, name, name_ar, region, sector")
      .order("name")
      .returns<Pick<AraOrganization, "id" | "name" | "name_ar" | "region" | "sector">[]>(),
    sb
      .from("ara_question_bank_versions")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<AraQuestionBankVersion[]>(),
  ]);

  const activeVersion = (versions ?? []).find((v) => v.is_active);

  // ─── Step 1: stage picker ─────────────────────────────────
  if (!selectedStage) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="mb-6">
            <Link href="/ara/consultant" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Back to assessments
            </Link>
          </div>

          <span className="ara-eyebrow">Step 1 of 2 · Pick a stage</span>
          <h1 className="text-2xl font-semibold text-primary mt-2 mb-1">
            What scope are you assessing?
          </h1>
          <p className="text-sm text-muted-foreground mb-8 max-w-2xl">
            Stage drives the pillars in scope, the report length, and whether
            this is a complimentary lead-in or a fee-based engagement. You
            can&apos;t change it later — start a new assessment if scope grows.
            Looking for the Personal Snapshot? It has its own self-served flow at{" "}
            <Link href="/ara/personal/start" className="underline hover:text-foreground">
              /ara/personal/start
            </Link>
            .
          </p>

          <div className="grid gap-5 md:grid-cols-3">
            {ARA_STAGE_DEFINITIONS
              .filter((stage) => stage.id !== "individual")
              .map((stage) => {
              const tone = TONE_MAP[stage.tone];
              const Icon = STAGE_ICONS[stage.id];
              return (
                <Link
                  key={stage.id}
                  href={`/ara/consultant/assessments/new?stage=${stage.id}`}
                  className="group block"
                >
                  <article
                    className="ara-tile p-6 h-full flex flex-col cursor-pointer"
                    style={{ borderTop: `3px solid ${tone.fg}` }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className="ara-tile-icon h-10 w-10 rounded-lg flex items-center justify-center"
                        style={{ background: tone.bgIcon, color: tone.fg }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-widest"
                        style={{ color: tone.fg }}
                      >
                        Stage {stage.number}
                      </span>
                    </div>

                    <h3 className="text-xl font-semibold text-primary mb-1">
                      {stage.label_en}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {stage.scope_en}
                    </p>

                    <div className="mb-4">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{
                          background: tone.bgSoft,
                          color: tone.fg,
                          border: `1px solid ${tone.border}`,
                        }}
                      >
                        {stage.is_pro_bono && <Sparkles className="h-3 w-3" />}
                        {stage.price_label_en}
                      </span>
                    </div>

                    <ul className="text-xs text-muted-foreground space-y-1.5 mt-auto">
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3 w-3" style={{ color: tone.fg }} />
                        {stage.applicable_pillars.length} of 8 pillars
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3 w-3" style={{ color: tone.fg }} />
                        {stage.typical_respondents} stakeholders
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3 w-3" style={{ color: tone.fg }} />
                        {stage.report_pages}-page branded report
                      </li>
                    </ul>
                  </article>
                </Link>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground mt-8">
            Need help choosing?{" "}
            <Link href="/ara/engage" className="underline hover:text-foreground">
              See the full comparison
            </Link>
            .
          </p>

          {/* ─── Starter templates catalogue ─── *
           * Pre-packaged role / sector / capability bundles - one-click
           * jump straight to Step 2 with the right stage + scope already
           * filled. Industry assessment vendors typically ship a similar
           * job-based assessment library; this is VIFM's GCC-tuned
           * equivalent. */}
          <section className="mt-14">
            <span className="ara-eyebrow">Or start from a template</span>
            <h2 className="text-xl font-semibold text-primary mt-2 mb-1">
              Pre-packaged starters
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
              Curated bundles tuned to common GCC engagement patterns. Picking
              one pre-fills the stage, sector, and pillar weights - you can
              still edit everything in Step 2.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ARA_ASSESSMENT_TEMPLATES.map((tpl) => {
                const tone = TONE_MAP[tpl.tone === "blue" || tpl.tone === "emerald" || tpl.tone === "rose" ? "violet" : tpl.tone];
                return (
                  <Link
                    key={tpl.id}
                    href={`/ara/consultant/assessments/new?stage=${tpl.default_stage}&template=${tpl.id}`}
                    className="group block"
                  >
                    <article
                      className="ara-tile p-4 h-full flex flex-col"
                      style={{ borderTop: `2px solid ${tone.fg}` }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="text-[9px] font-semibold uppercase tracking-widest"
                          style={{ color: tone.fg }}
                        >
                          {tpl.category}
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
                          Stage {tpl.default_stage === "department" ? 1 : tpl.default_stage === "division" ? 2 : 3}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-primary leading-tight">
                        {tpl.title_en}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-3 flex-1">
                        {tpl.description_en}
                      </p>
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t text-[10px] text-muted-foreground">
                        <span><strong className="text-foreground">{tpl.typical_respondents}</strong> respondents</span>
                        <span>·</span>
                        <span>~<strong className="text-foreground">{tpl.estimated_minutes}</strong> min</span>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ─── Step 2: details for the chosen stage ──────────────────
  const stage = ARA_STAGE_DEFINITIONS.find((s) => s.id === selectedStage)!;
  const tone = TONE_MAP[stage.tone];
  const Icon = STAGE_ICONS[stage.id];
  const scopeLabelHelp = stage.id === "department"
    ? "e.g. Risk Management, IT, Human Resources"
    : stage.id === "division"
      ? "e.g. Retail Banking, Treasury, Operations Division"
      : "Optional — leave blank for an organisation-wide assessment.";
  const scopeRequired = stage.id !== "enterprise";

  const createAssessmentAction = async (fd: FormData) => {
    "use server";
    await createAraAssessment(fd);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link
          href="/ara/consultant/assessments/new"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3 w-3" /> Change stage
        </Link>

        <span className="ara-eyebrow">Step 2 of 2 · Assessment details</span>
        <h1 className="text-2xl font-semibold text-primary mt-2 mb-1">New {stage.label_en} assessment</h1>
        <p className="text-muted-foreground mb-6">
          Region and sector are set at creation and never change.
        </p>

        {/* Stage summary card - confirms the user's choice from step 1 */}
        <div
          className="mb-6 rounded-lg p-4 flex items-start gap-3"
          style={{ background: tone.bgSoft, border: `1px solid ${tone.border}` }}
        >
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: tone.bgIcon, color: tone.fg }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: tone.fg }}
              >
                Stage {stage.number} · {stage.label_en}
              </span>
              {stage.is_pro_bono && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: tone.fg }}
                >
                  · Complimentary
                </span>
              )}
            </div>
            <p className="text-sm text-foreground">
              {stage.applicable_pillars.length} of 8 pillars · {stage.typical_respondents} stakeholders · {stage.report_pages}-page report
            </p>
            {selectedTemplate && (
              <p className="text-xs text-muted-foreground mt-1">
                Pre-filling from template: <strong>{selectedTemplate.title_en}</strong>
                {selectedTemplate.default_region !== "any" && (
                  <> · region locked to {selectedTemplate.default_region.toUpperCase()}</>
                )}
                {selectedTemplate.default_sector !== "any" && (
                  <> · sector defaulted to {selectedTemplate.default_sector}</>
                )}
              </p>
            )}
          </div>
        </div>

        {(!orgs || orgs.length === 0) && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 mb-6">
            <p className="text-sm text-amber-900">
              No client organizations exist yet.{" "}
              <Link href="/ara/admin/organizations/new" className="underline font-medium">
                Create one first
              </Link>
              .
            </p>
          </div>
        )}

        {!activeVersion && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 mb-6">
            <p className="text-sm text-amber-900">
              No active question bank version. Respondents will have no questions to answer until one is published.{" "}
              <Link href="/ara/admin/questions" className="underline font-medium">
                Manage versions
              </Link>
              .
            </p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assessment details</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createAssessmentAction} className="space-y-5">
              <input
                type="hidden"
                name="question_bank_version_id"
                value={activeVersion?.id ?? ""}
              />
              <input type="hidden" name="engagement_stage" value={stage.id} />

              <div className="space-y-2">
                <Label htmlFor="organization_id">Client organization *</Label>
                <select
                  id="organization_id"
                  name="organization_id"
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>Select organization…</option>
                  {(orgs ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} - {o.region === "uae" ? "UAE" : "Saudi"} / {o.sector}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scope label — required for department & division, optional for enterprise */}
              <div className="space-y-2">
                <Label htmlFor="scope_label">
                  {stage.id === "department" ? "Department name" : stage.id === "division" ? "Division name" : "Scope label (optional)"}
                  {scopeRequired && " *"}
                </Label>
                <input
                  id="scope_label"
                  name="scope_label"
                  type="text"
                  required={scopeRequired}
                  maxLength={120}
                  placeholder={scopeLabelHelp}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground">{scopeLabelHelp}</p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="region">Region *</Label>
                  <select
                    id="region"
                    name="region"
                    required
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={selectedTemplate?.default_region && selectedTemplate.default_region !== "any" ? selectedTemplate.default_region : ""}
                  >
                    <option value="" disabled>Select…</option>
                    <option value="uae">UAE</option>
                    <option value="saudi">Saudi Arabia</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sector">Sector *</Label>
                  <select
                    id="sector"
                    name="sector"
                    required
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={selectedTemplate?.default_sector && selectedTemplate.default_sector !== "any" ? selectedTemplate.default_sector : ""}
                  >
                    <option value="" disabled>Select…</option>
                    <option value="government">Government</option>
                    <option value="banking">Banking</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_language">Default language *</Label>
                <select
                  id="default_language"
                  name="default_language"
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue="en"
                >
                  <option value="en">English</option>
                  <option value="ar">Arabic - العربية</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Overridable per respondent.
                </p>
              </div>

              <IndividualLayerToggle />

              <div className="flex items-start gap-3 rounded-lg border p-4 bg-muted/30">
                <input
                  type="checkbox"
                  id="is_sandbox"
                  name="is_sandbox"
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <div className="flex-1">
                  <Label htmlFor="is_sandbox" className="cursor-pointer">
                    Sandbox assessment
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Test or demo data. Emails redirect to the sandbox address. Excluded from analytics. Can be bulk-deleted.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={!orgs || orgs.length === 0}>
                  Create assessment
                </Button>
                <Link href="/ara/consultant">
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
