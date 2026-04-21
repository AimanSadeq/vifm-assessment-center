import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import { createAraQuestion, publishAraVersion } from "@/lib/ara/actions";
import type { AraQuestion, AraQuestionBankVersion } from "@/types/ara";

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
                    <ol className="space-y-2 list-decimal list-inside">
                      {qs.map((q) => (
                        <li key={q.id} className="text-sm">
                          <span className="font-medium">Q{q.question_number}</span>{" "}
                          <Badge variant="outline" className="text-[10px] mr-1">L{q.layer}</Badge>
                          <Badge variant="secondary" className="text-[10px] mr-1 capitalize">{q.question_type}</Badge>
                          {q.question_text_en}
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

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
