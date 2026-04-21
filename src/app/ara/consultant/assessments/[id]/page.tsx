import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FlaskConical, Mail, Link2 } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import { createAraRespondent } from "@/lib/ara/actions";
import type {
  AraAssessment, AraOrganization, AraRespondent, AraRespondentPillarAssignment,
} from "@/types/ara";

type RespondentWithAssignments = AraRespondent & {
  assignments: Pick<AraRespondentPillarAssignment, "pillar_id">[];
};

export default async function AraAssessmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const sb = createServiceClient();

  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("*, organization:ara_organizations(id, name, name_ar, region, sector)")
    .eq("id", params.id)
    .maybeSingle<AraAssessment & { organization: Pick<AraOrganization, "id" | "name" | "name_ar" | "region" | "sector"> | null }>();

  if (!assessment) return notFound();

  const { data: respondents } = await sb
    .from("ara_respondents")
    .select("*, assignments:ara_respondent_pillar_assignments(pillar_id)")
    .eq("assessment_id", assessment.id)
    .order("created_at", { ascending: true })
    .returns<RespondentWithAssignments[]>();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/ara/consultant" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to assessments
        </Link>

        {assessment.is_sandbox && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-center gap-2 text-amber-900 text-sm">
            <FlaskConical className="h-4 w-4" />
            <span className="font-medium">This is a sandbox assessment.</span>
            <span>Emails redirect; data is excluded from analytics.</span>
          </div>
        )}

        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-primary">
              {assessment.organization?.name ?? "(no organization)"}
            </h1>
            <p className="text-muted-foreground">
              {assessment.region === "uae" ? "United Arab Emirates" : "Saudi Arabia"} •{" "}
              <span className="capitalize">{assessment.sector}</span> •{" "}
              Default language: {assessment.default_language === "en" ? "English" : "Arabic"}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="capitalize">{assessment.status}</Badge>
            <Badge variant="secondary" className="capitalize">
              {assessment.phase.replace("phase", "Phase ")}
            </Badge>
          </div>
        </div>

        {/* Respondents section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Respondents</CardTitle>
            <CardDescription>
              Stakeholders who will complete their assigned pillar sections.
              Each receives a unique access link — no account required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!respondents || respondents.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No respondents yet. Add one below.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Lang</TableHead>
                    <TableHead>Pillars assigned</TableHead>
                    <TableHead>Invite link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {respondents.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3 w-3" /> {r.email}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.role_label_en ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs uppercase">{r.language_preference}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.assignments.length === 0 ? (
                            <span className="text-xs text-muted-foreground">None</span>
                          ) : (
                            r.assignments.map((a) => (
                              <Badge key={a.pillar_id} variant="secondary" className="text-[10px]">
                                {ARA_PILLARS.find((p) => p.id === a.pillar_id)?.name_en ?? a.pillar_id}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/ara/respond/${r.access_token}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                        >
                          <Link2 className="h-3 w-3" /> Preview
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add respondent form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add respondent</CardTitle>
            <CardDescription>
              Assign one or more pillars. Respondent sees only their assigned sections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createAraRespondent} className="space-y-5">
              <input type="hidden" name="assessment_id" value={assessment.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" name="name" required maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name_ar">Name (Arabic)</Label>
                  <Input id="name_ar" name="name_ar" maxLength={200} dir="rtl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language_preference">Language</Label>
                  <select
                    id="language_preference"
                    name="language_preference"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={assessment.default_language}
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic — العربية</option>
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="role_label_en">Role (optional)</Label>
                  <Input
                    id="role_label_en"
                    name="role_label_en"
                    placeholder="e.g. Chief Executive Officer"
                    maxLength={200}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assign pillars</Label>
                <div className="grid gap-2 sm:grid-cols-2 rounded-lg border p-4">
                  {ARA_PILLARS.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="pillar_assignments"
                        value={p.id}
                        className="mt-0.5 h-4 w-4 rounded border-input"
                      />
                      <span>
                        <span className="block text-sm font-medium">{p.name_en}</span>
                        <span className="block text-xs text-muted-foreground" dir="rtl">{p.name_ar}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Button type="submit">Add respondent</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
