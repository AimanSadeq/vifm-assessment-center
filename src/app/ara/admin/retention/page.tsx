import Link from "next/link";
import { ArrowLeft, FileClock, AlertTriangle } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { purgeAraExpiredAssessments } from "@/lib/ara/admin-actions";

export const dynamic = "force-dynamic";

const RETENTION_YEARS = 3;

export default async function AraRetentionPage() {
  const sb = createServiceClient();

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);
  const cutoffIso = cutoff.toISOString();

  const { data: expired } = await sb
    .from("ara_assessments")
    .select("id, archived_at, region, sector, assessment_year, organization:ara_organizations(name)")
    .eq("status", "archived")
    .lt("archived_at", cutoffIso)
    .order("archived_at", { ascending: true });

  const { data: dueSoon } = await sb
    .from("ara_assessments")
    .select("id, archived_at, organization:ara_organizations(name)")
    .eq("status", "archived")
    .gte("archived_at", cutoffIso);

  const list = (expired ?? []) as unknown as Array<{
    id: string;
    archived_at: string;
    region: string;
    sector: string;
    assessment_year: number;
    organization: { name: string } | null;
  }>;

  const dueSoonList = (dueSoon ?? []) as unknown as Array<{
    id: string;
    archived_at: string;
    organization: { name: string } | null;
  }>;

  const purgeAction = async (fd: FormData) => {
    "use server";
    await purgeAraExpiredAssessments(fd);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/ara/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to ARA Admin
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <FileClock className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold text-primary">Data retention</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Assessments archived more than {RETENTION_YEARS} years ago are due for
          deletion per UAE PDPL / Saudi PDPL / GDPR retention rules. Generated
          reports are retained as VIFM business records.
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Expired - ready to purge</CardTitle>
            <CardDescription>
              {list.length} archived assessment{list.length === 1 ? "" : "s"} older than {RETENTION_YEARS} years.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing to purge.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Archived</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.organization?.name ?? "-"}</TableCell>
                      <TableCell>{e.assessment_year}</TableCell>
                      <TableCell className="uppercase">{e.region}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(e.archived_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Coming up for retention review</CardTitle>
            <CardDescription>
              Archived but still within the {RETENTION_YEARS}-year window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dueSoonList.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {dueSoonList.map((d) => {
                  const archived = new Date(d.archived_at);
                  const purgeAt = new Date(archived);
                  purgeAt.setFullYear(purgeAt.getFullYear() + RETENTION_YEARS);
                  return (
                    <li key={d.id} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{d.organization?.name ?? "-"}</span>
                      {" - archived "}{archived.toLocaleDateString()}
                      {", purges after "}{purgeAt.toLocaleDateString()}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Purge expired assessments
            </CardTitle>
            <CardDescription>
              Hard-deletes the {list.length} expired assessment{list.length === 1 ? "" : "s"} above
              and cascades to all children. Generated reports detach first (retained
              as business records). Action is logged in <code>ara_data_management_log</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={purgeAction} className="flex items-end gap-3">
              <div className="space-y-1 flex-1 max-w-md">
                <Label htmlFor="confirmation" className="text-xs">
                  Type <code>PURGE EXPIRED DATA</code> to confirm
                </Label>
                <Input
                  id="confirmation"
                  name="confirmation"
                  required
                  placeholder="PURGE EXPIRED DATA"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" variant="destructive" disabled={list.length === 0}>
                Purge {list.length}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
