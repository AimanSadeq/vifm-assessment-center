import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  updateAraOrganization, deleteAraOrganization, anonymizeAraOrganization,
} from "@/lib/ara/actions";
import type { AraOrganization } from "@/types/ara";

export const dynamic = "force-dynamic";

export default async function EditAraOrganizationPage({
  params,
}: {
  params: { id: string };
}) {
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
        <Link href="/ara/admin/organizations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to organizations
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-primary">Edit Organization</h1>
            <p className="text-muted-foreground text-sm">
              {assessmentCount ?? 0} linked assessment{assessmentCount === 1 ? "" : "s"}.
            </p>
          </div>
          {org.data_anonymized && (
            <Badge variant="destructive">Anonymized</Badge>
          )}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateAraOrganization} className="space-y-5">
              <input type="hidden" name="id" value={org.id} />

              <div className="space-y-2">
                <Label htmlFor="name">Name (English) *</Label>
                <Input id="name" name="name" required maxLength={200} defaultValue={org.name} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name_ar">Name (Arabic)</Label>
                <Input id="name_ar" name="name_ar" maxLength={200} dir="rtl" defaultValue={org.name_ar ?? ""} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">Region *</Label>
                <select
                  id="region"
                  name="region"
                  required
                  defaultValue={org.region}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="uae">United Arab Emirates</option>
                  <option value="saudi">Saudi Arabia</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sector">Sector *</Label>
                <select
                  id="sector"
                  name="sector"
                  required
                  defaultValue={org.sector}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="government">Government &amp; Semi-Government</option>
                  <option value="banking">Banking &amp; Financial Services</option>
                  <option value="general">General / Other</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit">Save changes</Button>
                <Link href="/ara/admin/organizations">
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Danger zone
            </CardTitle>
            <CardDescription>
              Data-erasure actions are logged in <code>ara_data_management_log</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Anonymize */}
            <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Anonymize organization</p>
                <p className="text-xs text-muted-foreground">
                  Replaces organization and respondent identifying fields with
                  <code className="mx-1">[ANONYMIZED]</code>. Preserves assessment
                  data for VIFM internal analytics. Required for UAE PDPL / Saudi
                  PDPL / GDPR erasure requests.
                </p>
              </div>
              <form action={anonymizeAction}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  disabled={org.data_anonymized}
                >
                  {org.data_anonymized ? "Anonymized" : "Anonymize"}
                </Button>
              </form>
            </div>

            {/* Delete */}
            <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Delete organization</p>
                <p className="text-xs text-muted-foreground">
                  Hard-deletes the organization and cascades to {assessmentCount ?? 0}{" "}
                  assessment{assessmentCount === 1 ? "" : "s"} and all their
                  respondents, answers, materials, and scores. Generated reports
                  are retained as VIFM business records.
                </p>
              </div>
              <form action={deleteAction}>
                <Button type="submit" variant="destructive" size="sm">
                  Delete
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
