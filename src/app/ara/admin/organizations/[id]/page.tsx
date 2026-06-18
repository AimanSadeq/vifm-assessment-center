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
import { CollectResultsButton } from "./_components/collect-results-button";
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

  // R9 - delegate completion across this org's assessments (no N+1: one
  // assessments query feeds one respondents query).
  let delegatesCompleted = 0;
  let delegatesTotal = 0;
  {
    const { data: orgAssessments } = await sb
      .from("ara_assessments")
      .select("id")
      .eq("organization_id", org.id)
      .returns<{ id: string }[]>();
    const assessmentIds = (orgAssessments ?? []).map((a) => a.id);
    if (assessmentIds.length > 0) {
      const { data: respondents } = await sb
        .from("ara_respondents")
        .select("completed_at")
        .in("assessment_id", assessmentIds)
        .returns<{ completed_at: string | null }[]>();
      delegatesTotal = (respondents ?? []).length;
      delegatesCompleted = (respondents ?? []).filter((r) => r.completed_at).length;
    }
  }

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
              {" · "}
              <span className="tabular-nums">
                {delegatesCompleted} / {delegatesTotal} delegates completed
              </span>
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

              {/* Results delivery (migrations 00108 + 00131) - who sees the
                  delegate's results, and whether they go to the client contact. */}
              <div className="space-y-4 rounded-lg border p-4">
                <p className="text-sm font-medium">Results delivery</p>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    name="respondent_can_view_results"
                    defaultChecked={org.respondent_can_view_results ?? true}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span className="text-sm">
                    Delegate can view their own results
                    <span className="block text-xs text-muted-foreground">
                      If off, the results page, PDF download, and the auto results email are withheld from the delegate.
                    </span>
                  </span>
                </label>
                <div className="space-y-2">
                  <Label htmlFor="client_contact_name">Client contact name</Label>
                  <Input
                    id="client_contact_name"
                    name="client_contact_name"
                    maxLength={200}
                    placeholder="Contact full name"
                    defaultValue={org.client_contact_name ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client_contact_email">Client contact email</Label>
                  <Input
                    id="client_contact_email"
                    name="client_contact_email"
                    type="email"
                    maxLength={200}
                    placeholder="contact@client.com"
                    defaultValue={org.client_contact_email ?? ""}
                  />
                </div>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    name="send_results_to_client"
                    defaultChecked={org.send_results_to_client ?? false}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span className="text-sm">
                    Send results to the client contact
                    <span className="block text-xs text-muted-foreground">
                      On completion, email each delegate&apos;s results PDF to the contact above. Requires a contact email.
                    </span>
                  </span>
                </label>
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

        {/* R10 - collect-and-send completed delegate results to the client */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Send results to client</CardTitle>
            <CardDescription>
              Email one consolidated message to the client contact with every
              completed delegate&apos;s results PDF attached.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground tabular-nums">
              {delegatesCompleted} of {delegatesTotal} delegate
              {delegatesTotal === 1 ? "" : "s"} completed.
              {!org.client_contact_email && " Set a client contact email above first."}
            </p>
            <CollectResultsButton
              orgId={org.id}
              clientEmail={org.client_contact_email ?? null}
              completedCount={delegatesCompleted}
            />
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
