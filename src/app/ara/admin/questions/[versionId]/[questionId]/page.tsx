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
import type { AraQuestion, AraQuestionBankVersion } from "@/types/ara";
import { ValidationEvidencePanel } from "./_components/validation-evidence-panel";

export const dynamic = "force-dynamic";

export default async function EditAraQuestionPage({
  params,
}: {
  params: { versionId: string; questionId: string };
}) {
  const sb = createServiceClient();
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
            { label: "ARA", href: "/ara" },
            { label: "Admin", href: "/ara/admin" },
            { label: "Question Bank", href: "/ara/admin/questions" },
            { label: `v${version.version_number}`, href: `/ara/admin/questions/${version.id}` },
            { label: `Q${question.question_number}` },
          ]}
        />
        <Link
          href={`/ara/admin/questions/${version.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3 w-3" /> Back to v{version.version_number}
        </Link>

        <h1 className="text-2xl font-semibold text-primary mb-1">
          Edit question Q{question.question_number}
        </h1>
        <p className="text-muted-foreground mb-8">
          Changes apply to all in-flight assessments. Historical completed
          assessments keep their original question text via version snapshots.
        </p>

        {/* ─── Lineage card ─────────────────────────────────────
            Surfaces the full chain item → construct → AC competencies →
            score map in one place. The reviewer (2026-04-29 voice note)
            flagged that consultants and clients ask "where did the
            questions come from? what are they measuring?" — this card
            makes every question's lineage explicit and copyable. */}
        <QuestionLineageCard question={question} />

        {/* ─── Validation-evidence panel (migration 00028) ──────
            Per-item content-validity trail. AI-suggested anchors get
            saved as 'ai_proposed' and stay invisible to clients until
            an admin verifies them — guards against LLM-hallucinated
            citations leaking into the consultant report. */}
        <ValidationEvidencePanel
          questionId={question.id}
          reviewerEmail="admin@vifm.ae"
          initialEvidence={question.validation_evidence ?? null}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Question details</CardTitle>
            <CardDescription>
              For multiple choice / yes-no, enter options and score_map as JSON.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateAction} className="space-y-5">
              <input type="hidden" name="id" value={question.id} />
              <input type="hidden" name="version_id" value={version.id} />

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="pillar_id">Pillar *</Label>
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
                  <Label htmlFor="question_number">Number *</Label>
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
                  <Label htmlFor="layer">Layer *</Label>
                  <select
                    id="layer"
                    name="layer"
                    defaultValue={String(question.layer)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="1">Layer 1 - client</option>
                    <option value="2">Layer 2 - consultant guide</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="question_type">Type *</Label>
                  <select
                    id="question_type"
                    name="question_type"
                    required
                    defaultValue={question.question_type}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="rating">Rating (1–5)</option>
                    <option value="multiple_choice">Multiple choice</option>
                    <option value="yes_no">Yes / No</option>
                    <option value="open_text">Open text</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="question_text_en">Question text (English) *</Label>
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
                <Label htmlFor="question_text_ar">Question text (Arabic) *</Label>
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
                  <Label htmlFor="options_en">Options (English) - JSON</Label>
                  <textarea
                    id="options_en"
                    name="options_en"
                    rows={3}
                    defaultValue={question.options_en ? JSON.stringify(question.options_en, null, 2) : ""}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="options_ar">Options (Arabic) - JSON</Label>
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
                <Label htmlFor="score_map">Score map - JSON</Label>
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
                  <Label htmlFor="region">Region filter</Label>
                  <select
                    id="region"
                    name="region"
                    defaultValue={question.region}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="both">Both UAE &amp; Saudi</option>
                    <option value="uae">UAE only</option>
                    <option value="saudi">Saudi only</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sector">Sector filter</Label>
                  <select
                    id="sector"
                    name="sector"
                    defaultValue={question.sector}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All sectors</option>
                    <option value="government">Government only</option>
                    <option value="banking">Banking only</option>
                    <option value="general">General only</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_order">Display order</Label>
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
                <Button type="submit">Save changes</Button>
                <Link href={`/ara/admin/questions/${version.id}`}>
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

// ─────────────────────────────────────────────────────────────
// Lineage card — explicit item → construct → AC competencies → score map
// ─────────────────────────────────────────────────────────────
function QuestionLineageCard({ question }: { question: AraQuestion }) {
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
          <CardTitle className="text-base">Lineage</CardTitle>
          {isIndividual ? (
            <Badge variant="secondary" className="text-[10px]">Individual layer</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">Org pillar layer</Badge>
          )}
          <Badge variant="outline" className="text-[10px] ms-auto">
            Layer {question.layer} · {question.question_type}
          </Badge>
        </div>
        <CardDescription>
          Every question is tagged at the database level to exactly one
          construct. This is the chain a consultant or client can show the
          stakeholder asking <em>&ldquo;where did this question come from?&rdquo;</em>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Item text */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
            1 · Item
          </p>
          <p className="text-sm">{question.question_text_en}</p>
          <p className="text-xs text-muted-foreground mt-1" dir="rtl">{question.question_text_ar}</p>
        </div>

        {/* Construct mapping */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
            2 · {isIndividual ? "Individual factor" : "Pillar"}
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
              No construct mapping found — investigate before publishing.
            </p>
          )}
        </div>

        {/* AC competencies (individual-only) */}
        {isIndividual && factor && factor.ac_competency_names.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              3 · Mapped AC competencies (drives course recommender + Learning Plan)
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
            {isIndividual ? "4" : "3"} · Score map
          </p>
          {scoreMap && Object.keys(scoreMap).length > 0 ? (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-start py-1.5 font-semibold text-muted-foreground">Option</th>
                  <th className="text-end py-1.5 font-semibold text-muted-foreground w-24">Score (1–5)</th>
                </tr>
              </thead>
              <tbody>
                {(optionsEn ?? Object.keys(scoreMap)).map((opt) => (
                  <tr key={opt} className="border-b last:border-b-0">
                    <td className="py-1.5">{opt}</td>
                    <td className="py-1.5 text-end font-mono tabular-nums">
                      {scoreMap[opt] ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No score map (open-text or unscored item).
            </p>
          )}
        </div>

        {/* Region / sector filters */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1 border-t">
          <span>Region: <strong className="text-foreground">{question.region}</strong></span>
          <span>·</span>
          <span>Sector: <strong className="text-foreground">{question.sector}</strong></span>
          <span>·</span>
          <span>Display order: <strong className="text-foreground">{question.display_order}</strong></span>
          <span>·</span>
          <span>{question.is_active ? "Active" : "Inactive"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
