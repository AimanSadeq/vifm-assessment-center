import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  updateAraOrganization, deleteAraOrganization, anonymizeAraOrganization,
} from "@/lib/ara/actions";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { getServerT } from "@/lib/i18n/server";
import type { AraOrganization } from "@/types/ara";

export const dynamic = "force-dynamic";

export default async function EditAraOrganizationPage({
  params,
}: {
  params: { id: string };
}) {
  const t = await getServerT();
  const sb = createServiceClient();
  const { data: org } = await sb
    .from("ara_organizations")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<AraOrganization>();

  if (!org) return notFound();

  // Count linked assessments so consultant knows the blast radius
  const { count: assessmentCount } = await sb
    .from("ara_assessments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);

  const updateAction = async (fd: FormData) => {
    "use server";
    await updateAraOrganization(fd);
  };

  const deleteAction = async () => {
    "use server";
    await deleteAraOrganization(org.id);
  };

  const anonymizeAction = async () => {
    "use server";
    await anonymizeAraOrganization(
      org.id,
      "Client data-erasure request via admin console"
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "ARA", href: "/ara" },
            { label: t("araAdmin.crumbAdmin"), href: "/ara/admin" },
            { label: t("araAdmin.crumbOrganizations"), href: "/ara/admin/organizations" },
            { label: org.name },
          ]}
        />
        <Link href="/ara/admin/organizations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> {t("araAdmin.orgFormBackToOrgs")}
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-primary">{t("araAdmin.orgEditTitle")}</h1>
            <p className="text-muted-foreground text-sm">
              {(assessmentCount ?? 0) === 1
                ? t("araAdmin.orgLinkedAssessmentOne", { count: assessmentCount ?? 0 })
                : t("araAdmin.orgLinkedAssessmentOther", { count: assessmentCount ?? 0 })}
            </p>
          </div>
          {org.data_anonymized && (
            <Badge variant="destructive">{t("araAdmin.anonymizedBadge")}</Badge>
          )}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t("araAdmin.orgDetailsCardTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateAction} className="space-y-5">
              <input type="hidden" name="id" value={org.id} />

              <div className="space-y-2">
                <Label htmlFor="name">{t("araAdmin.orgFieldNameEn")} *</Label>
                <Input id="name" name="name" required maxLength={200} defaultValue={org.name} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name_ar">{t("araAdmin.orgFieldNameAr")}</Label>
                <Input id="name_ar" name="name_ar" maxLength={200} dir="rtl" defaultValue={org.name_ar ?? ""} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">{t("araAdmin.orgFieldRegion")} *</Label>
                <select
                  id="region"
                  name="region"
                  required
                  defaultValue={org.region}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="uae">{t("araAdmin.regionUaeFull")}</option>
                  <option value="saudi">{t("araAdmin.regionSaudi")}</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sector">{t("araAdmin.orgFieldSector")} *</Label>
                <select
                  id="sector"
                  name="sector"
                  required
                  defaultValue={org.sector}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="government">{t("araAdmin.sectorGovernment")}</option>
                  <option value="banking">{t("araAdmin.sectorBanking")}</option>
                  <option value="general">{t("araAdmin.sectorGeneral")}</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit">{t("araAdmin.orgSaveButton")}</Button>
                <Link href="/ara/admin/organizations">
                  <Button type="button" variant="outline">{t("araAdmin.cancel")}</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {t("araAdmin.dangerZoneTitle")}
            </CardTitle>
            <CardDescription>
              {t("araAdmin.dangerZoneLogPrefix")} <code>ara_data_management_log</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Anonymize */}
            <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{t("araAdmin.anonymizeHeading")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("araAdmin.anonymizeDescPrefix")}
                  <code className="mx-1">[ANONYMIZED]</code>{t("araAdmin.anonymizeDescSuffix")}
                </p>
              </div>
              <ConfirmAction
                action={anonymizeAction}
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                title={t("araAdmin.anonymizeConfirmTitle")}
                description={
                  <>
                    {t("araAdmin.anonymizeConfirmPrefix")} <code className="mx-1 bg-muted px-1 rounded">[ANONYMIZED]</code>
                    {t("araAdmin.anonymizeConfirmSuffix")}
                  </>
                }
                confirmLabel={t("araAdmin.anonymizeConfirmLabel")}
                successMessage={t("araAdmin.anonymizeSuccess")}
                disabled={org.data_anonymized}
              >
                {org.data_anonymized ? t("araAdmin.anonymizedBadge") : t("araAdmin.anonymizeConfirmLabel")}
              </ConfirmAction>
            </div>

            {/* Delete */}
            <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{t("araAdmin.deleteHeading")}</p>
                <p className="text-xs text-muted-foreground">
                  {(assessmentCount ?? 0) === 1
                    ? t("araAdmin.deleteDescOne", { count: assessmentCount ?? 0 })
                    : t("araAdmin.deleteDescOther", { count: assessmentCount ?? 0 })}
                </p>
              </div>
              <ConfirmAction
                action={deleteAction}
                title={t("araAdmin.deleteConfirmTitle")}
                description={
                  <>
                    {t("araAdmin.deleteConfirmPrefix")}{" "}
                    <strong>
                      {(assessmentCount ?? 0) === 1
                        ? t("araAdmin.deleteConfirmCountOne", { count: assessmentCount ?? 0 })
                        : t("araAdmin.deleteConfirmCountOther", { count: assessmentCount ?? 0 })}
                    </strong>
                    {t("araAdmin.deleteConfirmMiddle")} <strong>{t("araAdmin.deleteConfirmNotReversible")}</strong>
                    {" "}{t("araAdmin.deleteConfirmSuffix")}
                  </>
                }
                confirmLabel={t("araAdmin.deleteConfirmLabel")}
                successMessage={t("araAdmin.deleteSuccess")}
              >
                {t("araAdmin.deleteConfirmLabel")}
              </ConfirmAction>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
