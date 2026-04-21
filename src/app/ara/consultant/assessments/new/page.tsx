import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAraAssessment } from "@/lib/ara/actions";
import type { AraOrganization, AraQuestionBankVersion } from "@/types/ara";

export default async function NewAraAssessmentPage() {
  const sb = createServiceClient();
  const [{ data: orgs }, { data: versions }] = await Promise.all([
    sb
      .from("ara_organizations")
      .select("id, name, name_ar, region, sector")
      .order("name")
      .returns<Pick<AraOrganization, "id" | "name" | "name_ar" | "region" | "sector">[]>(),
    sb
      .from("ara_question_bank_versions")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<AraQuestionBankVersion[]>(),
  ]);

  const activeVersion = (versions ?? []).find((v) => v.is_active);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/ara/consultant" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to assessments
        </Link>

        <h1 className="text-2xl font-semibold text-primary mb-1">New Assessment</h1>
        <p className="text-muted-foreground mb-8">
          Region and sector are set at creation and never change. They drive regulatory framework selection.
        </p>

        {(!orgs || orgs.length === 0) && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 mb-6">
            <p className="text-sm text-amber-900">
              No client organizations exist yet.{" "}
              <Link href="/ara/admin/organizations/new" className="underline font-medium">
                Create one first
              </Link>
              .
            </p>
          </div>
        )}

        {!activeVersion && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 mb-6">
            <p className="text-sm text-amber-900">
              No active question bank version. Respondents will have no questions to answer until one is published.{" "}
              <Link href="/ara/admin/questions" className="underline font-medium">
                Manage versions
              </Link>
              .
            </p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assessment details</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createAraAssessment} className="space-y-5">
              <input
                type="hidden"
                name="question_bank_version_id"
                value={activeVersion?.id ?? ""}
              />

              <div className="space-y-2">
                <Label htmlFor="organization_id">Client organization *</Label>
                <select
                  id="organization_id"
                  name="organization_id"
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>Select organization…</option>
                  {(orgs ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} — {o.region === "uae" ? "UAE" : "Saudi"} / {o.sector}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="region">Region *</Label>
                  <select
                    id="region"
                    name="region"
                    required
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue=""
                  >
                    <option value="" disabled>Select…</option>
                    <option value="uae">UAE</option>
                    <option value="saudi">Saudi Arabia</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sector">Sector *</Label>
                  <select
                    id="sector"
                    name="sector"
                    required
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue=""
                  >
                    <option value="" disabled>Select…</option>
                    <option value="government">Government</option>
                    <option value="banking">Banking</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_language">Default language *</Label>
                <select
                  id="default_language"
                  name="default_language"
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue="en"
                >
                  <option value="en">English</option>
                  <option value="ar">Arabic — العربية</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Overridable per respondent.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-lg border p-4 bg-muted/30">
                <input
                  type="checkbox"
                  id="is_sandbox"
                  name="is_sandbox"
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <div className="flex-1">
                  <Label htmlFor="is_sandbox" className="cursor-pointer">
                    Sandbox assessment
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Test or demo data. Emails redirect to the sandbox address. Excluded from analytics. Can be bulk-deleted.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={!orgs || orgs.length === 0}>
                  Create assessment
                </Button>
                <Link href="/ara/consultant">
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
