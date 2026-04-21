import Link from "next/link";
import { ArrowLeft, Plus, FlaskConical } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { AraAssessment, AraOrganization } from "@/types/ara";

type AssessmentRow = AraAssessment & {
  organization: Pick<AraOrganization, "id" | "name" | "name_ar"> | null;
};

const statusVariant: Record<AraAssessment["status"], "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  active: "default",
  completed: "secondary",
  frozen: "secondary",
  archived: "destructive",
};

export default async function AraConsultantPage() {
  const sb = createServiceClient();
  const { data: rows } = await sb
    .from("ara_assessments")
    .select("*, organization:ara_organizations(id, name, name_ar)")
    .order("created_at", { ascending: false })
    .returns<AssessmentRow[]>();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/ara" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to ARA
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-primary">Assessments</h1>
            <p className="text-muted-foreground">
              Your AI Readiness assessments across GCC clients.
            </p>
          </div>
          <Link href="/ara/consultant/assessments/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New assessment
            </Button>
          </Link>
        </div>

        {!rows || rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">No assessments yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create an assessment to invite respondents and begin Phase 1 discovery.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Sandbox</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link href={`/ara/consultant/assessments/${row.id}`} className="font-medium hover:underline">
                      {row.organization?.name ?? "(no organization)"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.region === "uae" ? "default" : "secondary"}>
                      {row.region === "uae" ? "UAE" : "Saudi"}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{row.sector}</TableCell>
                  <TableCell className="uppercase">{row.default_language}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[row.status]} className="capitalize">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{row.phase.replace("phase", "Phase ")}</TableCell>
                  <TableCell>
                    {row.is_sandbox ? (
                      <span title="Sandbox assessment" className="inline-flex items-center gap-1 text-amber-600">
                        <FlaskConical className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
