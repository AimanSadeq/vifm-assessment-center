import Link from "next/link";
import { ArrowLeft, Plus, Check } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createAraVersion } from "@/lib/ara/actions";
import type { AraQuestionBankVersion } from "@/types/ara";

export default async function AraQuestionsVersionsPage() {
  const sb = createServiceClient();

  const { data: versions } = await sb
    .from("ara_question_bank_versions")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<AraQuestionBankVersion[]>();

  // Count questions per version
  const { data: qCounts } = await sb
    .from("ara_questions")
    .select("version_id");
  const countMap = new Map<string, number>();
  (qCounts ?? []).forEach((q) => {
    countMap.set(q.version_id, (countMap.get(q.version_id) ?? 0) + 1);
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/ara/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to ARA Admin
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-primary">Question Bank</h1>
          <p className="text-muted-foreground">
            Manage question bank versions. Only one version is active at a time; new assessments use the active version.
          </p>
        </div>

        {/* Existing versions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Versions</CardTitle>
            <CardDescription>
              Click a version to view or edit its questions. Published versions cannot be modified in place;
              changes require a new version bump.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!versions || versions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No versions yet. Create one below to start authoring questions.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <Link href={`/ara/admin/questions/${v.id}`} className="font-medium hover:underline">
                          v{v.version_number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {v.version_label ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{countMap.get(v.id) ?? 0}</Badge>
                      </TableCell>
                      <TableCell>
                        {v.is_active ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 text-sm">
                            <Check className="h-3.5 w-3.5" /> Active
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Draft</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {v.published_at ? new Date(v.published_at).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create version */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-4 w-4" /> Create new version
            </CardTitle>
            <CardDescription>
              Version rules: Minor bump (1.0 → 1.1) for additions or wording fixes. Major bump (1.x → 2.0) for scoring changes or structural changes.
              Year-on-year comparison is only valid within the same major version.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createAraVersion} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="version_number">Version number *</Label>
                  <Input
                    id="version_number"
                    name="version_number"
                    required
                    placeholder="1.0"
                    pattern="\d+\.\d+"
                    title="Use MAJOR.MINOR format (e.g. 1.0, 1.1, 2.0)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="version_label">Label (optional)</Label>
                  <Input
                    id="version_label"
                    name="version_label"
                    maxLength={200}
                    placeholder="e.g. Launch baseline"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="release_notes">Release notes</Label>
                <textarea
                  id="release_notes"
                  name="release_notes"
                  rows={3}
                  maxLength={5000}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="What changed in this version?"
                />
              </div>

              <Button type="submit">Create draft version</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
