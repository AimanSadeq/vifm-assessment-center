import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitBranch } from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import {
  ARA_INDIVIDUAL_FACTOR_MAP, type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import { updateAraQuestion } from "@/lib/ara/actions";
import { getServerT, type ServerT } from "@/lib/i18n/server";
import type { AraQuestion, AraQuestionBankVersion } from "@/types/ara";
import { ValidationEvidencePanel } from "./_components/validation-evidence-panel";

export const dynamic = "force-dynamic";

export default async function EditAraQuestionPage({
  params,
}: {
  params: { versionId: string; questionId: string };
}) {
  const sb = createServiceClient();
  const t = await getServerT();
  const [{ data: version }, { data: question }] = await Promise.all([
    sb
      .from("ara_question_bank_versions")
      .select("*")
      .eq("id", params.versionId)
      .maybeSingle<AraQuestionBankVersion>(),
    sb
      .from("ara_questions")
      .select("*")
      .eq("id", params.questionId)
      .eq("version_id", params.versionId)
      .maybeSingle<AraQuestion>(),
  ]);

  if (!version || !question) return notFound();

  const updateAction = async (fd: FormData) => {
    "use server";
    await updateAraQuestion(fd);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Breadcrumbs
          items={[
            { label: t("araAdminData.eq_bc_ara"), href: "/ara" },
            { label: t("araAdminData.eq_bc_admin"), href: "/ara/admin" },
            { label: t("araAdminData.eq_bc_question_bank"), href: "/ara/admin/questions" },
            { label: `v${version.version_number}`, href: `/ara/admin/questions/${version.id}` },
            { label: `Q${question.question_number}` },
          ]}
        />
        <Link
          href={`/ara/admin/questions/${version.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3 w-3" /> {t("araAdminData.back_to_version", { version: version.version_number })}
        </Link>

        <h1 className="text-2xl font-semibold text-primary mb-1">
          {t("araAdminData.eq_title", { number: question.question_number })}
        </h1>
        <p className="text-muted-foreground mb-8">
          {t("araAdminData.eq_subtitle")}
        </p>

        {/* ─── Lineage card ─────────────────────────────────────
            Surfaces the full chain item → construct → AC competencies →
            score map in one place. The reviewer (2026-04-29 voice note)
            flagged that consultants and clients ask "where did the
            questions come from? what are they measuring?" - this card
            makes every question's lineage explicit and copyable. */}
        <QuestionLineageCard question={question} t={t} />

        {/* ─── Validation-evidence panel (migration 00028) ──────
            Per-item content-validity trail. AI-suggested anchors get
            saved as 'ai_proposed' and stay invisible to clients until
            an admin verifies them - guards against LLM-hallucinated
            citations leaking into the consultant report. */}
        <ValidationEvidencePanel
          questionId={question.id}
          reviewerEmail="admin@vifm.ae"
          initialEvidence={question.validation_evidence ?? null}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("araAdminData.eq_details_title")}</CardTitle>
            <CardDescription>
              {t("araAdminData.eq_details_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateAction} className="space-y-5">
              <input type="hidden" name="id" value={question.id} />
              <input type="hidden" name="version_id" value={version.id} />

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="pillar_id">{t("araAdminData.vd_pillar_label")}</Label>
                  <select
                    id="pillar_id"
                    name="pillar_id"
                    required
                    defaultValue={question.pillar_id}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {ARA_PILLARS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name_en}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="question_number">{t("araAdminData.vd_number_label")}</Label>
                  <Input
                    id="question_number"
                    name="question_number"
                    type="number"
                    min={1}
                    required
                    defaultValue={question.question_number}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="layer">{t("araAdminData.vd_layer_label")}</Label>
                  <select
                    id="layer"
                    name="layer"
                    defaultValue={String(question.layer)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="1">{t("araAdminData.vd_layer1_option")}</option>
                    <option value="2">{t("araAdminData.vd_layer2_option")}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="question_type">{t("araAdminData.vd_type_label")}</Label>
                  <select
                    id="question_type"
                    name="question_type"
                    required
                    defaultValue={question.question_type}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="rating">{t("araAdminData.vd_type_rating")}</option>
                    <option value="multiple_choice">{t("araAdminData.vd_type_multiple_choice")}</option>
                    <option value="yes_no">{t("araAdminData.vd_type_yes_no")}</option>
                    <option value="open_text">{t("araAdminData.vd_type_open_text")}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="question_text_en">{t("araAdminData.vd_question_text_en_label")}</Label>
                <textarea
                  id="question_text_en"
                  name="question_text_en"
                  rows={2}
                  required
                  defaultValue={question.question_text_en}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="question_text_ar">{t("araAdminData.vd_question_text_ar_label")}</Label>
                <textarea
                  id="question_text_ar"
                  name="question_text_ar"
                  rows={2}
                  required
                  dir="rtl"
                  defaultValue={question.question_text_ar}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="options_en">{t("araAdminData.eq_options_en_label")}</Label>
                  <textarea
                    id="options_en"
                    name="options_en"
                    rows={3}
                    defaultValue={question.options_en ? JSON.stringify(question.options_en, null, 2) : ""}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="options_ar">{t("araAdminData.eq_options_ar_label")}</Label>
                  <textarea
                    id="options_ar"
                    name="options_ar"
                    rows={3}
                    dir="rtl"
                    defaultValue={question.options_ar ? JSON.stringify(question.options_ar, null, 2) : ""}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="score_map">{t("araAdminData.eq_score_map_label")}</Label>
                <textarea
                  id="score_map"
                  name="score_map"
                  rows={2}
                  defaultValue={question.score_map ? JSON.stringify(question.score_map) : ""}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-xs"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="region">{t("araAdminData.vd_region_label")}</Label>
                  <select
                    id="region"
                    name="region"
                    defaultValue={question.region}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="both">{t("araAdminData.vd_region_both")}</option>
                    <option value="uae">{t("araAdminData.vd_region_uae")}</option>
                    <option value="saudi">{t("araAdminData.vd_region_saudi")}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sector">{t("araAdminData.vd_sector_label")}</Label>
                  <select
                    id="sector"
                    name="sector"
                    defaultValue={question.sector}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">{t("araAdminData.vd_sector_all")}</option>
                    <option value="government">{t("araAdminData.vd_sector_government")}</option>
                    <option value="banking">{t("araAdminData.vd_sector_banking")}</option>
                    <option value="general">{t("araAdminData.vd_sector_general")}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_order">{t("araAdminData.vd_display_order_label")}</Label>
                  <Input
                    id="display_order"
                    name="display_order"
                    type="number"
                    min={0}
                    defaultValue={question.display_order}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit">{t("araAdminData.eq_save_button")}</Button>
                <Link href={`/ara/admin/questions/${version.id}`}>
                  <Button type="button" variant="outline">{t("araAdminData.eq_cancel_button")}</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Lineage card - explicit item → construct → AC competencies → score map
// ─────────────────────────────────────────────────────────────
function QuestionLineageCard({ question, t }: { question: AraQuestion; t: ServerT }) {
  const pillar = ARA_PILLARS.find((p) => p.id === question.pillar_id);
  const factorId = question.individual_factor_id as AraIndividualFactorId | null;
  const factor = factorId ? ARA_INDIVIDUAL_FACTOR_MAP[factorId] : null;
  const isIndividual = !!factor;

  const scoreMap = (question.score_map ?? null) as Record<string, number> | null;
  const optionsEn = (question.options_en ?? null) as string[] | null;

  return (
    <Card className="mb-6 border-accent/30 bg-accent/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-accent" />
          <CardTitle className="text-base">{t("araAdminData.lin_title")}</CardTitle>
          {isIndividual ? (
            <Badge variant="secondary" className="text-[10px]">{t("araAdminData.lin_individual_badge")}</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">{t("araAdminData.lin_org_badge")}</Badge>
          )}
          <Badge variant="outline" className="text-[10px] ms-auto">
            {t("araAdminData.lin_layer_type", { layer: question.layer, type: question.question_type })}
          </Badge>
        </div>
        <CardDescription>
          {t("araAdminData.lin_desc_prefix")} <em>{t("araAdminData.lin_desc_question")}</em>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Item text */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
            {t("araAdminData.lin_step1_item")}
          </p>
          <p className="text-sm">{question.question_text_en}</p>
          <p className="text-xs text-muted-foreground mt-1" dir="rtl">{question.question_text_ar}</p>
        </div>

        {/* Construct mapping */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
            {isIndividual ? t("araAdminData.lin_step2_factor") : t("araAdminData.lin_step2_pillar")}
          </p>
          {isIndividual && factor ? (
            <div className="rounded-md border bg-card p-3">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: factor.color }}
                />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {factor.domain}
                </span>
                <span className="text-sm font-semibold">{factor.name_en}</span>
                <span className="text-xs text-muted-foreground" dir="rtl">{factor.name_ar}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">{factor.description_en}</p>
            </div>
          ) : pillar ? (
            <div className="rounded-md border bg-card p-3">
              <div className="text-sm font-semibold">{pillar.name_en}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{pillar.description_en}</div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              {t("araAdminData.lin_no_construct")}
            </p>
          )}
        </div>

        {/* AC competencies (individual-only) */}
        {isIndividual && factor && factor.ac_competency_names.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              {t("araAdminData.lin_step3_competencies")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {factor.ac_competency_names.map((name) => (
                <Badge key={name} variant="outline" className="text-[11px] font-normal">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Score map */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
            {t("araAdminData.lin_score_map_step", { step: isIndividual ? "4" : "3" })}
          </p>
          {scoreMap && Object.keys(scoreMap).length > 0 ? (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-start py-1.5 font-semibold text-muted-foreground">{t("araAdminData.lin_col_option")}</th>
                  <th className="text-end py-1.5 font-semibold text-muted-foreground w-24">{t("araAdminData.lin_col_score")}</th>
                </tr>
              </thead>
              <tbody>
                {(optionsEn ?? Object.keys(scoreMap)).map((opt) => (
                  <tr key={opt} className="border-b last:border-b-0">
                    <td className="py-1.5">{opt}</td>
                    <td className="py-1.5 text-end font-mono tabular-nums">
                      {scoreMap[opt] ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              {t("araAdminData.lin_no_score_map")}
            </p>
          )}
        </div>

        {/* Region / sector filters */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1 border-t">
          <span>{t("araAdminData.lin_region")} <strong className="text-foreground">{question.region}</strong></span>
          <span>·</span>
          <span>{t("araAdminData.lin_sector")} <strong className="text-foreground">{question.sector}</strong></span>
          <span>·</span>
          <span>{t("araAdminData.lin_display_order")} <strong className="text-foreground">{question.display_order}</strong></span>
          <span>·</span>
          <span>{question.is_active ? t("araAdminData.lin_active") : t("araAdminData.lin_inactive")}</span>
        </div>
      </CardContent>
    </Card>
  );
}
