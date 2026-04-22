import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import { updateAraQuestion } from "@/lib/ara/actions";
import type { AraQuestion, AraQuestionBankVersion } from "@/types/ara";

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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Question details</CardTitle>
            <CardDescription>
              For multiple choice / yes-no, enter options and score_map as JSON.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateAraQuestion} className="space-y-5">
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
                    <option value="1">Layer 1 — client</option>
                    <option value="2">Layer 2 — consultant guide</option>
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
                  <Label htmlFor="options_en">Options (English) — JSON</Label>
                  <textarea
                    id="options_en"
                    name="options_en"
                    rows={3}
                    defaultValue={question.options_en ? JSON.stringify(question.options_en, null, 2) : ""}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="options_ar">Options (Arabic) — JSON</Label>
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
                <Label htmlFor="score_map">Score map — JSON</Label>
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
