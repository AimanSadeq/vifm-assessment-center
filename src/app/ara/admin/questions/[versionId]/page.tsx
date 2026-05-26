import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Upload, Sparkles, Download } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import {
  createAraQuestion, publishAraVersion,
  importAraQuestionsCsv,
  aiAuthorAraQuestion,
} from "@/lib/ara/actions";
import { isAIConfigured } from "@/lib/ai/client";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { DraggableQuestionList } from "./_components/draggable-question-list";
import type { AraQuestion, AraQuestionBankVersion } from "@/types/ara";

export const dynamic = "force-dynamic";

export default async function AraVersionDetailPage({
  params,
}: {
  params: { versionId: string };
}) {
  const sb = createServiceClient();

  // The route accepts either a UUID (the canonical id) or a human-
  // friendly version_number like "v1.1" / "1.1" so admins can type the
  // version label they actually remember instead of pasting a UUID.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const param = params.versionId;
  const versionLookup = UUID_RE.test(param)
    ? sb.from("ara_question_bank_versions").select("*").eq("id", param).maybeSingle<AraQuestionBankVersion>()
    : sb.from("ara_question_bank_versions").select("*").eq("version_number", param.replace(/^v/i, "")).maybeSingle<AraQuestionBankVersion>();
  const { data: version } = await versionLookup;

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

  const aiAuthorAction = async (fd: FormData) => {
    "use server";
    await aiAuthorAraQuestion(fd);
  };

  const importCsvAction = async (fd: FormData) => {
    "use server";
    await importAraQuestionsCsv(fd);
  };

  const createQuestionAction = async (fd: FormData) => {
    "use server";
    await createAraQuestion(fd);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/ara/admin/questions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to versions
        </Link>

        <div className="flex items-start justify-between mb-4 gap-4">
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
              <ConfirmAction
                action={publishAction}
                variant="default"
                size="default"
                destructive={false}
                title="Publish and activate this version?"
                description={
                  <>
                    All new assessments created from now on will use{" "}
                    <strong>v{version.version_number}</strong> as their question bank.
                    Existing in-flight assessments keep their original version.
                    The currently active version (if any) will be deactivated.
                  </>
                }
                confirmLabel="Publish & activate"
                successMessage={`v${version.version_number} activated`}
              >
                Publish &amp; activate
              </ConfirmAction>
            )}
          </div>
        </div>

        {/* Pillar quick-jump nav. Each chip is an anchor link to the
            corresponding pillar card below - saves the admin scrolling
            through eight cards to find Strategy or Governance questions. */}
        <div className="mb-8 flex flex-wrap gap-2 items-center">
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold me-2">
            Jump to pillar
          </span>
          {ARA_PILLARS.map((pillar) => {
            const count = byPillar.get(pillar.id)?.length ?? 0;
            return (
              <a
                key={pillar.id}
                href={`#pillar-${pillar.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-input bg-card hover:bg-muted transition-colors"
              >
                {pillar.name_en}
                <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
              </a>
            );
          })}
        </div>

        {/* Questions per pillar */}
        <div className="space-y-6 mb-8">
          {ARA_PILLARS.map((pillar) => {
            const qs = byPillar.get(pillar.id) ?? [];
            const verifiedCount = qs.filter((q) => {
              const ev = (q as AraQuestion & { validation_evidence?: { review_status?: string } | null }).validation_evidence;
              return ev?.review_status === "verified" || ev?.review_status === "edited";
            }).length;
            return (
              <Card key={pillar.id} id={`pillar-${pillar.id}`} className="scroll-mt-24">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span>{pillar.name_en}</span>
                    <span className="flex items-center gap-2">
                      {qs.length > 0 && (
                        <span
                          className="text-[10px] font-medium text-muted-foreground"
                          title={`${verifiedCount} of ${qs.length} questions have admin-verified validation evidence`}
                        >
                          {verifiedCount}/{qs.length} verified
                        </span>
                      )}
                      <Badge variant="outline">{qs.length}</Badge>
                    </span>
                  </CardTitle>
                  <CardDescription dir="rtl" className="text-right">{pillar.name_ar}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {([1, 2] as const).map((layer) => {
                    const layerQs = qs.filter((q) => q.layer === layer);
                    if (layerQs.length === 0) return null;
                    return (
                      <div key={layer}>
                        {layer === 2 && (
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                            Layer 2 - consultant guide (never shown to respondents)
                          </p>
                        )}
                        <DraggableQuestionList
                          versionId={version.id}
                          pillarId={pillar.id}
                          layer={layer}
                          initialQuestions={layerQs.map((q) => {
                            const ev = (q as AraQuestion & { validation_evidence?: { review_status?: string } | null }).validation_evidence;
                            const status = ev?.review_status as
                              | "ai_proposed" | "verified" | "edited" | "rejected" | undefined;
                            return {
                              id: q.id,
                              question_number: q.question_number,
                              question_text_en: q.question_text_en,
                              layer: q.layer,
                              evidence_status: status ?? null,
                            };
                          })}
                        />
                      </div>
                    );
                  })}
                  {qs.length === 0 && (
                    <p className="text-xs text-muted-foreground">No questions in this pillar yet.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* AI question authoring assistant */}
        <Card className="mb-6 overflow-hidden" style={{ borderLeft: "3px solid #7C3AED" }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: "#7C3AED" }} />
              Author with AI
              {!isAIConfigured() && (
                <Badge variant="outline" className="ms-2 text-[10px] uppercase tracking-widest">
                  Disabled - configure ANTHROPIC_API_KEY
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Describe what you want to ask in plain English; the AI drafts a fully-formed bilingual question
              anchored to a published framework (UAE PDPL, SDAIA NDGF, ISO 42001, NIST AI RMF, OECD AI Principles).
              Drafts are inserted as <strong>inactive</strong> for human review before going live.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={aiAuthorAction} className="space-y-4">
              <input type="hidden" name="version_id" value={version.id} />

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="ai_pillar_id">Pillar *</Label>
                  <select
                    id="ai_pillar_id"
                    name="pillar_id"
                    required
                    defaultValue=""
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="" disabled>Select pillar…</option>
                    {ARA_PILLARS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name_en}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai_layer">Layer *</Label>
                  <select
                    id="ai_layer"
                    name="layer"
                    defaultValue="1"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="1">Layer 1 - client</option>
                    <option value="2">Layer 2 - consultant guide</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai_similar_to">Similar style to (optional)</Label>
                  <Input
                    id="ai_similar_to"
                    name="similar_to"
                    placeholder="paste an existing question to mirror tone-of-voice"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai_brief">What do you want the question to assess? *</Label>
                <textarea
                  id="ai_brief"
                  name="brief"
                  rows={3}
                  required
                  placeholder='e.g. "Whether the organisation has a formal AI red-team programme that probes models for prompt-injection and jailbreak vulnerabilities before production deployment"'
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={!isAIConfigured()}
                  style={{ background: "#7C3AED" }}
                  className="text-white hover:opacity-90"
                >
                  <Sparkles className="h-4 w-4 me-1.5" /> Generate draft
                </Button>
                <p className="text-xs text-muted-foreground">
                  Drafts insert at the end of the pillar. Review the question, edit if needed, then activate.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* CSV bulk import + export */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-4 w-4" /> CSV bulk import
                </CardTitle>
                <CardDescription>
                  Required columns: <code className="text-xs">pillar_id, question_number, question_text_en, question_text_ar, question_type</code>.
                  Optional: <code className="text-xs">options_en, options_ar, score_map, help_text_en, help_text_ar, region, sector, layer, display_order</code>.
                  JSON fields accept valid JSON or empty.
                </CardDescription>
              </div>
              <a
                href={`/api/ara/admin/questions/${version.id}/csv`}
                className="shrink-0"
              >
                <Button type="button" variant="outline" size="sm">
                  <Download className="h-3.5 w-3.5 me-1.5" /> Export CSV
                </Button>
              </a>
            </div>
          </CardHeader>
          <CardContent>
            <form action={importCsvAction} className="flex items-end gap-3 flex-wrap">
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
            <form action={createQuestionAction} className="space-y-5">
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
                    Options (English) - JSON array <span className="text-muted-foreground text-xs">(multiple_choice / yes_no)</span>
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
                  <Label htmlFor="options_ar">Options (Arabic) - JSON array</Label>
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
                  Score map - JSON object <span className="text-muted-foreground text-xs">(option value → 1.0–5.0)</span>
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
