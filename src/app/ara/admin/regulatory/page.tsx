import Link from "next/link";
import { ArrowLeft, FileText, Upload, Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { isAIConfigured } from "@/lib/ai/client";
import {
  uploadAraRegulatoryDocument, deleteAraRegulatoryDocument,
} from "@/lib/ara/admin-actions";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type FrameworkRow = {
  id: string;
  region: "uae" | "saudi";
  framework_code: string;
  framework_name_en: string;
  framework_name_ar: string;
  tier: number;
};

type DocumentRow = {
  id: string;
  region: string;
  document_name_en: string;
  file_name: string | null;
  processing_status: string;
  uploaded_at: string;
  notes: string | null;
};

export default async function AraRegulatoryAdminPage() {
  const sb = createServiceClient();
  const t = await getServerT();

  const [{ data: frameworks }, { data: documents }, { data: requirementCounts }] = await Promise.all([
    sb
      .from("ara_regulatory_frameworks")
      .select("id, region, framework_code, framework_name_en, framework_name_ar, tier")
      .eq("is_active", true)
      .order("region")
      .order("tier")
      .order("display_order")
      .returns<FrameworkRow[]>(),
    sb
      .from("ara_regulatory_documents")
      .select("id, region, document_name_en, file_name, processing_status, uploaded_at, notes")
      .order("uploaded_at", { ascending: false })
      .returns<DocumentRow[]>(),
    sb
      .from("ara_regulatory_requirements")
      .select("framework_id"),
  ]);

  // Group requirement counts by framework_id
  const requirementsByFramework = new Map<string, number>();
  (requirementCounts ?? []).forEach((r) => {
    requirementsByFramework.set(r.framework_id, (requirementsByFramework.get(r.framework_id) ?? 0) + 1);
  });

  const aiReady = isAIConfigured();

  const uploadAction = async (fd: FormData) => {
    "use server";
    await uploadAraRegulatoryDocument(fd);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "ARA", href: "/ara" },
            { label: t("araAdminData.eq_bc_admin"), href: "/ara/admin" },
            { label: t("araAdminData.reg_bc_regulatory") },
          ]}
        />
        <Link href="/ara/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> {t("araAdminData.back_to_admin")}
        </Link>

        <h1 className="text-2xl font-semibold text-primary mb-1">{t("araAdminData.reg_title")}</h1>
        <p className="text-muted-foreground mb-8">
          {t("araAdminData.reg_subtitle")}
        </p>

        {/* Upload form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-4 w-4" /> {t("araAdminData.reg_upload_title")}
            </CardTitle>
            <CardDescription>
              {aiReady
                ? t("araAdminData.reg_upload_desc_ready")
                : t("araAdminData.reg_upload_desc_disabled")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={uploadAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="framework_id">{t("araAdminData.reg_framework_label")}</Label>
                  <select
                    id="framework_id"
                    name="framework_id"
                    required
                    defaultValue=""
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="" disabled>{t("araAdminData.reg_select")}</option>
                    {(frameworks ?? []).map((f) => (
                      <option key={f.id} value={f.id}>
                        [{f.region.toUpperCase()} · T{f.tier}] {f.framework_code} - {f.framework_name_en}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="document_name">{t("araAdminData.reg_document_name_label")}</Label>
                  <Input
                    id="document_name"
                    name="document_name"
                    type="text"
                    required
                    placeholder={t("araAdminData.reg_document_name_placeholder")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file" className="text-xs">{t("araAdminData.reg_file_label")}</Label>
                <input
                  id="file"
                  type="file"
                  name="file"
                  accept=".pdf,application/pdf"
                  required
                  className="text-xs file:me-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-xs"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={!aiReady}>
                  <Upload className="h-4 w-4 me-1.5" /> {t("araAdminData.reg_upload_button")}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {t("araAdminData.reg_upload_hint")}
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Frameworks summary */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">{t("araAdminData.reg_frameworks_title", { count: (frameworks ?? []).length })}</CardTitle>
            <CardDescription>
              {t("araAdminData.reg_frameworks_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {(frameworks ?? []).map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border bg-card text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] uppercase">{f.region}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{t("araAdminData.reg_tier", { tier: f.tier })}</Badge>
                    <span className="font-medium">{f.framework_code}</span>
                    <span className="text-muted-foreground">{f.framework_name_en}</span>
                  </div>
                  <Badge>{t("araAdminData.reg_reqs", { count: requirementsByFramework.get(f.id) ?? 0 })}</Badge>
                </div>
              ))}
              {(frameworks ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">{t("araAdminData.reg_no_frameworks")}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Uploaded documents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-4 w-4" /> {t("araAdminData.reg_documents_title", { count: (documents ?? []).length })}
            </CardTitle>
            <CardDescription>
              {t("araAdminData.reg_documents_desc_prefix")} <em>{t("araAdminData.reg_documents_desc_processing")}</em> {t("araAdminData.reg_documents_desc_to")} <em>{t("araAdminData.reg_documents_desc_review")}</em> {t("araAdminData.reg_documents_desc_on")} <em>{t("araAdminData.reg_documents_desc_rejected")}</em> {t("araAdminData.reg_documents_desc_suffix")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(documents ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("araAdminData.reg_no_documents")}</p>
            ) : (
              <div className="space-y-2">
                {(documents ?? []).map((d) => {
                  const StatusIcon =
                    d.processing_status === "review" || d.processing_status === "approved"
                      ? CheckCircle2
                      : d.processing_status === "rejected"
                      ? AlertCircle
                      : Loader2;
                  const statusColor =
                    d.processing_status === "review" || d.processing_status === "approved"
                      ? "text-emerald-600"
                      : d.processing_status === "rejected"
                      ? "text-destructive"
                      : "text-muted-foreground";
                  const deleteAction = async () => {
                    "use server";
                    await deleteAraRegulatoryDocument(d.id);
                  };
                  return (
                    <div key={d.id} className="rounded-md border bg-card p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] uppercase">{d.region}</Badge>
                            <span className="font-medium">{d.document_name_en}</span>
                            <span className={`inline-flex items-center gap-1 text-xs ${statusColor}`}>
                              <StatusIcon className={`h-3 w-3 ${d.processing_status === "processing" ? "animate-spin" : ""}`} />
                              {d.processing_status}
                            </span>
                          </div>
                          {d.file_name && (
                            <p className="text-xs text-muted-foreground mt-1">{d.file_name}</p>
                          )}
                          {d.notes && (
                            <p className="text-xs mt-1 text-muted-foreground italic">{d.notes}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("araAdminData.reg_uploaded_at", { when: new Date(d.uploaded_at).toLocaleString() })}
                          </p>
                        </div>
                        <ConfirmAction
                          action={deleteAction}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-transparent"
                          title={t("araAdminData.reg_delete_title")}
                          description={
                            <>
                              {t("araAdminData.reg_delete_desc_prefix")} <strong>{t("araAdminData.reg_delete_desc_bold")}</strong> {t("araAdminData.reg_delete_desc_suffix")}
                            </>
                          }
                          confirmLabel={t("araAdminData.reg_delete_confirm")}
                          successMessage={t("araAdminData.reg_delete_success")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </ConfirmAction>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
