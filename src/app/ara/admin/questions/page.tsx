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
import { getServerT } from "@/lib/i18n/server";
import type { AraQuestionBankVersion } from "@/types/ara";

export default async function AraQuestionsVersionsPage() {
  const sb = createServiceClient();
  const t = await getServerT();

  const { data: versions } = await sb
    .from("ara_question_bank_versions")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<AraQuestionBankVersion[]>();

  // Count questions per version
  const { data: qCounts } = await sb
    .from("ara_questions")
    .select("version_id");
  const createVersionAction = async (fd: FormData) => {
    "use server";
    await createAraVersion(fd);
  };

  const countMap = new Map<string, number>();
  (qCounts ?? []).forEach((q) => {
    countMap.set(q.version_id, (countMap.get(q.version_id) ?? 0) + 1);
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/ara/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> {t("araAdminData.back_to_ara_admin")}
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-primary">{t("araAdminData.qb_title")}</h1>
          <p className="text-muted-foreground">
            {t("araAdminData.qb_subtitle")}
          </p>
        </div>

        {/* Existing versions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t("araAdminData.qb_versions_title")}</CardTitle>
            <CardDescription>
              {t("araAdminData.qb_versions_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!versions || versions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("araAdminData.qb_no_versions")}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("araAdminData.qb_col_version")}</TableHead>
                    <TableHead>{t("araAdminData.qb_col_label")}</TableHead>
                    <TableHead>{t("araAdminData.qb_col_questions")}</TableHead>
                    <TableHead>{t("araAdminData.qb_col_active")}</TableHead>
                    <TableHead>{t("araAdminData.qb_col_published")}</TableHead>
                    <TableHead>{t("araAdminData.qb_col_created")}</TableHead>
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
                            <Check className="h-3.5 w-3.5" /> {t("araAdminData.qb_active")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("araAdminData.qb_draft")}</span>
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
              <Plus className="h-4 w-4" /> {t("araAdminData.qb_create_title")}
            </CardTitle>
            <CardDescription>
              {t("araAdminData.qb_create_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createVersionAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="version_number">{t("araAdminData.qb_version_number_label")}</Label>
                  <Input
                    id="version_number"
                    name="version_number"
                    required
                    placeholder="1.0"
                    pattern="\d+\.\d+"
                    title={t("araAdminData.qb_version_number_title")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="version_label">{t("araAdminData.qb_version_label_label")}</Label>
                  <Input
                    id="version_label"
                    name="version_label"
                    maxLength={200}
                    placeholder={t("araAdminData.qb_version_label_placeholder")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="release_notes">{t("araAdminData.qb_release_notes_label")}</Label>
                <textarea
                  id="release_notes"
                  name="release_notes"
                  rows={3}
                  maxLength={5000}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder={t("araAdminData.qb_release_notes_placeholder")}
                />
              </div>

              <Button type="submit">{t("araAdminData.qb_create_button")}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
