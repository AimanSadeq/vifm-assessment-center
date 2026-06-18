import Link from "next/link";
import { ArrowLeft, Building2, Network, Globe2, Sparkles, Check, User } from "lucide-react";
import { IndividualLayerToggle } from "./_components/individual-layer-toggle";
import { AgenticLayerToggle } from "./_components/agentic-layer-toggle";
import { PillarPicker } from "./_components/pillar-picker";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAraAssessment } from "@/lib/ara/actions";
import { resolvePlanOrgId } from "@/lib/start/resolve-plan-org";
import { ARA_STAGE_DEFINITIONS } from "@/lib/constants/ara-stages";
import { ARA_ASSESSMENT_TEMPLATES, getAssessmentTemplate } from "@/lib/constants/ara-assessment-templates";
import { validateTalentLens } from "@/lib/constants/ara-individual-factors";
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
  searchParams?: { stage?: string; template?: string; org?: string; orgName?: string; lens?: string };
}) {
  const t = await getServerT();
  // Talent lens captured from the launching pillar (migration 00134). Threaded
  // through the stage pick + posted as a hidden field on the create form.
  const lens = validateTalentLens(searchParams?.lens);
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

  // Combined-plan deep link: prefill the client + preserve it across the stage pick.
  const defaultOrgId = resolvePlanOrgId((orgs ?? []) as { id: string; name: string | null }[], searchParams);
  const orgQuery =
    (searchParams?.org
      ? `&org=${encodeURIComponent(searchParams.org)}&orgName=${encodeURIComponent(searchParams.orgName ?? "")}`
      : "") + (lens ? `&lens=${lens}` : "");

  // ─── Step 1: stage picker ─────────────────────────────────
  if (!selectedStage) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="mb-6">
            <Link href="/ara/consultant" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> {t("araConsultant.new_back_to_assessments")}
            </Link>
          </div>

          <span className="ara-eyebrow">{t("araConsultant.new_step1_eyebrow")}</span>
          <h1 className="text-2xl font-semibold text-primary mt-2 mb-1">
            {t("araConsultant.new_step1_title")}
          </h1>
          <p className="text-sm text-muted-foreground mb-8 max-w-2xl">
            {t("araConsultant.new_step1_intro_before")}
            <Link href="/ara/personal/start" className="underline hover:text-foreground">
              /ara/personal/start
            </Link>
            {t("araConsultant.new_step1_intro_after")}
          </p>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {ARA_STAGE_DEFINITIONS.map((stage) => {
              const tone = TONE_MAP[stage.tone];
              const Icon = STAGE_ICONS[stage.id];
              // Personal is self-served (4 individual factors, not org pillars),
              // so its card routes to the consultant personal deep-dive issuance,
              // never the org pillar wizard (?stage=individual).
              const isIndividual = stage.id === "individual";
              const href = isIndividual
                ? `/ara/consultant/personal-deep-dive/new${lens ? `?lens=${lens}` : ""}`
                : `/ara/consultant/assessments/new?stage=${stage.id}${orgQuery}`;
              return (
                <Link key={stage.id} href={href} className="group block">
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
                        {isIndividual
                          ? t("araConsultant.new_stage_personal")
                          : t("araConsultant.new_stage_label", { n: stage.number })}
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
                        {isIndividual
                          ? t("araConsultant.new_stage_factors")
                          : t("araConsultant.new_stage_pillars_of_8", { n: stage.applicable_pillars.length })}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3 w-3" style={{ color: tone.fg }} />
                        {t("araConsultant.new_stage_stakeholders", { n: stage.typical_respondents })}
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3 w-3" style={{ color: tone.fg }} />
                        {t("araConsultant.new_stage_report_pages", { n: stage.report_pages })}
                      </li>
                      {!isIndividual && (
                        <li className="flex items-center gap-1.5 opacity-75">
                          <User className="h-3 w-3" style={{ color: tone.fg }} />
                          {t("araConsultant.new_stage_optional_individual")}
                        </li>
                      )}
                    </ul>
                  </article>
                </Link>
              );
            })}
          </div>

          {/* Mode C signpost. The "Include individual layer" toggle is on
              Step 2, but reviewers (incl. one on 2026-04-29) miss it
              entirely and assume the platform "removed corporate /
              department / division". Calling it out here means it's
              visible regardless of which stage card the consultant
              clicks through. */}
          <div className="mt-8 rounded-lg border border-accent/30 bg-accent/5 p-4 flex items-start gap-3">
            <div className="rounded-full bg-accent/15 p-1.5 mt-0.5">
              <User className="h-3.5 w-3.5 text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary">
                {t("araConsultant.new_signpost_title")}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {t("araConsultant.new_signpost_body")}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-6">
            {t("araConsultant.new_help_choosing_before")}
            <Link href="/ara/engage" className="underline hover:text-foreground">
              {t("araConsultant.new_help_choosing_link")}
            </Link>
            {t("araConsultant.new_help_choosing_after")}
          </p>

          {/* ─── Starter templates catalogue ─── *
           * Pre-packaged role / sector / capability bundles - one-click
           * jump straight to Step 2 with the right stage + scope already
           * filled. Industry assessment vendors typically ship a similar
           * job-based assessment library; this is VIFM's GCC-tuned
           * equivalent. */}
          <section className="mt-14">
            <span className="ara-eyebrow">{t("araConsultant.new_templates_eyebrow")}</span>
            <h2 className="text-xl font-semibold text-primary mt-2 mb-1">
              {t("araConsultant.new_templates_title")}
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
              {t("araConsultant.new_templates_intro")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ARA_ASSESSMENT_TEMPLATES.map((tpl) => {
                const tone = TONE_MAP[tpl.tone === "blue" || tpl.tone === "emerald" || tpl.tone === "rose" ? "violet" : tpl.tone];
                return (
                  <Link
                    key={tpl.id}
                    href={`/ara/consultant/assessments/new?stage=${tpl.default_stage}&template=${tpl.id}${orgQuery}`}
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
                          {t("araConsultant.new_stage_label", { n: tpl.default_stage === "department" ? 1 : tpl.default_stage === "division" ? 2 : 3 })}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-primary leading-tight">
                        {tpl.title_en}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-3 flex-1">
                        {tpl.description_en}
                      </p>
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t text-[10px] text-muted-foreground">
                        <span><strong className="text-foreground">{tpl.typical_respondents}</strong> {t("araConsultant.new_template_respondents")}</span>
                        <span>·</span>
                        <span>~<strong className="text-foreground">{tpl.estimated_minutes}</strong> {t("araConsultant.new_template_minutes")}</span>
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
    ? t("araConsultant.new_scope_help_department")
    : stage.id === "division"
      ? t("araConsultant.new_scope_help_division")
      : t("araConsultant.new_scope_help_enterprise");
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
          <ArrowLeft className="h-3 w-3" /> {t("araConsultant.new_change_stage")}
        </Link>

        <span className="ara-eyebrow">{t("araConsultant.new_step2_eyebrow")}</span>
        <h1 className="text-2xl font-semibold text-primary mt-2 mb-1">{t("araConsultant.new_step2_title", { stage: stage.label_en })}</h1>
        <p className="text-muted-foreground mb-6">
          {t("araConsultant.new_step2_subtitle")}
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
                {t("araConsultant.new_stage_label", { n: stage.number })} · {stage.label_en}
              </span>
              {stage.is_pro_bono && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: tone.fg }}
                >
                  {t("araConsultant.new_stage_summary_complimentary")}
                </span>
              )}
            </div>
            <p className="text-sm text-foreground">
              {t("araConsultant.new_stage_summary_line", { pillars: stage.applicable_pillars.length, stakeholders: stage.typical_respondents, pages: stage.report_pages })}
            </p>
            {selectedTemplate && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("araConsultant.new_prefill_from_template")} <strong>{selectedTemplate.title_en}</strong>
                {selectedTemplate.default_region !== "any" && (
                  <>{t("araConsultant.new_prefill_region_locked", { region: selectedTemplate.default_region.toUpperCase() })}</>
                )}
                {selectedTemplate.default_sector !== "any" && (
                  <>{t("araConsultant.new_prefill_sector_defaulted", { sector: selectedTemplate.default_sector })}</>
                )}
              </p>
            )}
          </div>
        </div>

        {(!orgs || orgs.length === 0) && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 mb-6">
            <p className="text-sm text-amber-900">
              {t("araConsultant.new_no_orgs_before")}
              <Link href="/ara/admin/organizations/new" className="underline font-medium">
                {t("araConsultant.new_no_orgs_link")}
              </Link>
              {t("araConsultant.new_no_orgs_after")}
            </p>
          </div>
        )}

        {!activeVersion && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 mb-6">
            <p className="text-sm text-amber-900">
              {t("araConsultant.new_no_active_version_before")}
              <Link href="/ara/admin/questions" className="underline font-medium">
                {t("araConsultant.new_no_active_version_link")}
              </Link>
              {t("araConsultant.new_no_active_version_after")}
            </p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("araConsultant.new_card_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createAssessmentAction} className="space-y-5">
              <input
                type="hidden"
                name="question_bank_version_id"
                value={activeVersion?.id ?? ""}
              />
              <input type="hidden" name="engagement_stage" value={stage.id} />
              {/* Talent lens (migration 00134) - carried from the launching pillar. */}
              {lens && <input type="hidden" name="talent_lens" value={lens} />}

              <div className="space-y-2">
                <Label htmlFor="organization_id">{t("araConsultant.new_field_organization")}</Label>
                <select
                  id="organization_id"
                  name="organization_id"
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={defaultOrgId}
                >
                  <option value="" disabled>{t("araConsultant.new_select_organization")}</option>
                  {(orgs ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} - {o.region === "uae" ? t("araConsultant.list_region_uae") : t("araConsultant.list_region_saudi")} / {o.sector}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scope label - required for department & division, optional for enterprise */}
              <div className="space-y-2">
                <Label htmlFor="scope_label">
                  {stage.id === "department" ? t("araConsultant.new_field_department_name") : stage.id === "division" ? t("araConsultant.new_field_division_name") : t("araConsultant.new_field_scope_label_optional")}
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

              <div className="space-y-2">
                <Label htmlFor="time_limit_minutes">{t("araConsultant.new_field_time_limit")}</Label>
                <input
                  id="time_limit_minutes"
                  name="time_limit_minutes"
                  type="number"
                  min={1}
                  max={600}
                  placeholder={t("araConsultant.new_field_time_limit_ph")}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground">{t("araConsultant.new_field_time_limit_help")}</p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="region">{t("araConsultant.new_field_region")}</Label>
                  <select
                    id="region"
                    name="region"
                    required
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={selectedTemplate?.default_region && selectedTemplate.default_region !== "any" ? selectedTemplate.default_region : ""}
                  >
                    <option value="" disabled>{t("araConsultant.new_select_placeholder")}</option>
                    <option value="uae">{t("araConsultant.new_region_uae")}</option>
                    <option value="saudi">{t("araConsultant.new_region_saudi")}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sector">{t("araConsultant.new_field_sector")}</Label>
                  <select
                    id="sector"
                    name="sector"
                    required
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={selectedTemplate?.default_sector && selectedTemplate.default_sector !== "any" ? selectedTemplate.default_sector : ""}
                  >
                    <option value="" disabled>{t("araConsultant.new_select_placeholder")}</option>
                    <option value="government">{t("araConsultant.new_sector_government")}</option>
                    <option value="banking">{t("araConsultant.new_sector_banking")}</option>
                    <option value="general">{t("araConsultant.new_sector_general")}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_language">{t("araConsultant.new_field_default_language")}</Label>
                <select
                  id="default_language"
                  name="default_language"
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue="en"
                >
                  <option value="en">{t("araConsultant.new_language_en")}</option>
                  <option value="ar">{t("araConsultant.new_language_ar")}</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {t("araConsultant.new_language_help")}
                </p>
              </div>

              <IndividualLayerToggle />

              <AgenticLayerToggle />

              {/* Pillar selector - Department picks 4, Division picks 6.
                  Enterprise stays at all 8 (no UI shown). */}
              {(stage.id === "department" || stage.id === "division") && (
                <div className="rounded-lg border p-4 bg-muted/20">
                  <Label className="text-sm font-semibold">
                    {t("araConsultant.new_pillars_label", { n: stage.id === "department" ? 4 : 6 })}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">
                    {t("araConsultant.new_pillars_help")}
                  </p>
                  <PillarPicker
                    defaultPillars={stage.applicable_pillars}
                    requiredCount={stage.id === "department" ? 4 : 6}
                  />
                </div>
              )}

              <div className="flex items-start gap-3 rounded-lg border p-4 bg-muted/30">
                <input
                  type="checkbox"
                  id="is_sandbox"
                  name="is_sandbox"
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <div className="flex-1">
                  <Label htmlFor="is_sandbox" className="cursor-pointer">
                    {t("araConsultant.new_sandbox_label")}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("araConsultant.new_sandbox_help")}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={!orgs || orgs.length === 0}>
                  {t("araConsultant.new_create")}
                </Button>
                <Link href="/ara/consultant">
                  <Button type="button" variant="outline">{t("araConsultant.new_cancel")}</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
