import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Upload } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import {
  createAraQuestion, publishAraVersion,
  deleteAraQuestion, moveAraQuestion,
  importAraQuestionsCsv,
} from "@/lib/ara/actions";
import type { AraQuestion, AraQuestionBankVersion } from "@/types/ara";

export const dynamic = "force-dynamic";

export default async function AraVersionDetailPage({
  params,
}: {
  params: { versionId: string };
}) {
  const sb = createServiceClient();

  const { data: version } = await sb
    .from("ara_question_bank_versions")
    .select("*")
    .eq("id", params.versionId)
    .maybeSingle<AraQuestionBankVersion>();

  if (!version) return notFound();

  const { data: questions } = await sb
    .from("ara_questions")
    .select("*")
    .eq("version_id", version.id)
    .order("pillar_id", { ascending: true })
    .order("display_order", { ascending: true })
    .returns<AraQuestion[]>();

  // Group questions by pillar
  const byPillar = new Map<string, AraQuestion[]>();
  (questions ?? []).forEach((q) => {
    const arr = byPillar.get(q.pillar_id) ?? [];
    arr.push(q);
    byPillar.set(q.pillar_id, arr);
  });

  const publishAction = async () => {
    "use server";
    await publishAraVersion(version.id);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/ara/admin/questions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to versions
        </Link>

        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-primary">
              Question Bank v{version.version_number}
            </h1>
            {version.version_label && (
              <p className="text-muted-foreground">{version.version_label}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {version.is_active ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
            ) : (
              <form action={publishAction}>
                <Button type="submit" variant="default">
                  Publish &amp; activate
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Questions per pillar */}
        <div className="space-y-6 mb-8">
          {ARA_PILLARS.map((pillar) => {
            const qs = byPillar.get(pillar.id) ?? [];
            return (
              <Card key={pillar.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{pillar.name_en}</span>
                    <Badge variant="outline">{qs.length}</Badge>
                  </CardTitle>
                  <CardDescription dir="rtl" className="text-right">{pillar.name_ar}</CardDescription>
                </CardHeader>
                <CardContent>
                  {qs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No questions in this pillar yet.</p>
                  ) : (
                    <ol className="space-y-2">
                      {qs.map((q, idx) => {
                        const moveUpAction = async () => {
                          "use server";
                          await moveAraQuestion(q.id, "up");
                        };
                        const moveDownAction = async () => {
                          "use server";
                          await moveAraQuestion(q.id, "down");
                        };
                        const deleteAction = async () => {
                          "use server";
                          await deleteAraQuestion(q.id, version.id);
                        };
                        return (
                          <li key={q.id} className="text-sm flex items-start gap-2">
                            <div className="flex flex-col -gap-px">
                              <form action={moveUpAction}>
                                <button
                                  type="submit"
                                  disabled={idx === 0}
                                  className="h-4 w-5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                                  aria-label="Move up"
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                              </form>
                              <form action={moveDownAction}>
                                <button
                                  type="submit"
                                  disabled={idx === qs.length - 1}
                                  className="h-4 w-5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                                  aria-label="Move down"
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              </form>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">Q{q.question_number}</span>{" "}
                              <Badge variant="outline" className="text-[10px] mx-1">L{q.layer}</Badge>
                              <Badge variant="secondary" className="text-[10px] me-1 capitalize">{q.question_type}</Badge>
                              {q.question_text_en}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Link
                                href={`/ara/admin/questions/${version.id}/${q.id}`}
                                className="p-1 text-muted-foreground hover:text-foreground"
                                aria-label="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                              <form action={deleteAction}>
                                <button
                                  type="submit"
                                  className="p-1 text-muted-foreground hover:text-destructive"
                                  aria-label="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </form>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* CSV bulk import */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-4 w-4" /> CSV bulk import
            </CardTitle>
            <CardDescription>
              Required columns: <code className="text-xs">pillar_id, question_number, question_text_en, question_text_ar, question_type</code>.
              Optional: <code className="text-xs">options_en, options_ar, score_map, help_text_en, help_text_ar, region, sector, layer, display_order</code>.
              JSON fields accept valid JSON or empty.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={importAraQuestionsCsv} className="flex items-end gap-3 flex-wrap">
              <input type="hidden" name="version_id" value={version.id} />
              <div className="space-y-1">
                <Label htmlFor="csv_file" className="text-xs">CSV file</Label>
                <input
                  id="csv_file"
                  type="file"
                  name="file"
                  accept=".csv,text/csv"
                  required
                  className="text-xs file:me-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-xs"
                />
              </div>
              <Button type="submit" size="sm">Import</Button>
            </form>
          </CardContent>
        </Card>

        {/* Add question */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add question
            </CardTitle>
            <CardDescription>
              Layer 1 = client-facing. Layer 2 = consultant guide (never shown to client).
              For multiple choice / yes-no, enter options and score_map as JSON.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createAraQuestion} className="space-y-5">
              <input type="hidden" name="version_id" value={version.id} />

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="pillar_id">Pillar *</Label>
                  <select
                    id="pillar_id"
                    name="pillar_id"
                    required
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue=""
                  >
                    <option value="" disabled>Select…</option>
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
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="layer">Layer *</Label>
                  <select
                    id="layer"
                    name="layer"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue="1"
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
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue=""
                  >
                    <option value="" disabled>Select…</option>
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
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="options_en">
                    Options (English) — JSON array <span className="text-muted-foreground text-xs">(multiple_choice / yes_no)</span>
                  </Label>
                  <textarea
                    id="options_en"
                    name="options_en"
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-xs"
                    placeholder='[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]'
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="options_ar">Options (Arabic) — JSON array</Label>
                  <textarea
                    id="options_ar"
                    name="options_ar"
                    rows={3}
                    dir="rtl"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-xs"
                    placeholder='[{"value":"yes","label":"نعم"},{"value":"no","label":"لا"}]'
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="score_map">
                  Score map — JSON object <span className="text-muted-foreground text-xs">(option value → 1.0–5.0)</span>
                </Label>
                <textarea
                  id="score_map"
                  name="score_map"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-xs"
                  placeholder='{"no":1.0,"yes":4.0}'
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="region">Region filter</Label>
                  <select
                    id="region"
                    name="region"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue="both"
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
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue="all"
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
                    defaultValue={0}
                  />
                </div>
              </div>

              <Button type="submit">Add question</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
