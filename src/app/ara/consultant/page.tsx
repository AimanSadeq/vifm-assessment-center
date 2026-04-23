import Link from "next/link";
import { Plus, FlaskConical, ClipboardList, CheckCircle2, Snowflake } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AraTopBar } from "@/components/shared/ara-top-bar";
import type { AraAssessment, AraOrganization } from "@/types/ara";

type AssessmentRow = AraAssessment & {
  organization: Pick<AraOrganization, "id" | "name" | "name_ar"> | null;
};

function StatChip({
  icon: Icon, label, value, accent,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2 min-w-[88px] ${accent ? "bg-accent/5 border-accent/30" : "bg-muted/30"}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`ara-numeral text-xl font-semibold mt-0.5 ${accent ? "text-accent" : "text-primary"}`}>
        {value}
      </div>
    </div>
  );
}

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

  const total = rows?.length ?? 0;
  const completed = (rows ?? []).filter((r) => r.status === "completed" || r.status === "frozen").length;
  const frozen = (rows ?? []).filter((r) => r.status === "frozen").length;

  return (
    <div className="min-h-screen bg-background">
      <AraTopBar role="consultant" />

      {/* ─── Hero strip ─── */}
      <section className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="ara-eyebrow">Consultant</span>
            <h1 className="ara-numeral text-3xl font-semibold text-primary mt-2">Assessments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your AI Readiness engagements across GCC clients.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatChip icon={ClipboardList} label="Total" value={total} />
            <StatChip icon={CheckCircle2} label="Completed" value={completed} accent />
            <StatChip icon={Snowflake} label="Frozen" value={frozen} />
            <Link href="/ara/consultant/assessments/new" className="ms-2">
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> New assessment
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {!rows || rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-16 text-center bg-card">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium text-foreground">No assessments yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-sm mx-auto">
              Create your first engagement to invite respondents, gather evidence, and begin Phase 1 discovery.
            </p>
            <Link href="/ara/consultant/assessments/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Create first assessment
              </Button>
            </Link>
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
