import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EngagementStatusFilter } from "./_components/engagement-status-filter";
import { ProjectListToolbar } from "./_components/project-list-toolbar";

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  active: "default",
  completed: "outline",
  archived: "destructive",
};

export default async function EngagementsPage({
  searchParams,
}: {
  searchParams: { status?: string; sort?: string; dir?: string; client?: string };
}) {
  const supabase = await createClient();
  const filterStatus = searchParams.status || "all";
  const sortField = searchParams.sort || "created_at";
  const sortDir = searchParams.dir === "asc";
  const clientFilter = searchParams.client || "all";

  let query = supabase
    .from("engagements")
    .select("id, name, status, target_role, start_date, end_date, organization_id, organizations(name)")
    .order(sortField === "client" ? "created_at" : sortField, { ascending: sortField === "client" ? false : sortDir });

  if (filterStatus !== "all") {
    query = query.eq("status", filterStatus);
  }
  if (clientFilter && clientFilter !== "all") {
    query = query.eq("organization_id", clientFilter);
  }

  const { data: engagements } = await query;

  // Get counts from all engagements (unfiltered)
  const { data: allEngagements } = await supabase
    .from("engagements")
    .select("status");

  // Get all organizations for client filter
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name");

  const counts = {
    all: allEngagements?.length ?? 0,
    draft: allEngagements?.filter((e) => e.status === "draft").length ?? 0,
    active: allEngagements?.filter((e) => e.status === "active").length ?? 0,
    completed: allEngagements?.filter((e) => e.status === "completed").length ?? 0,
  };

  // Sort by client name client-side if requested
  let sorted = engagements ?? [];
  if (sortField === "client") {
    sorted = [...sorted].sort((a, b) => {
      const aName = (a.organizations as { name: string } | null)?.name ?? "";
      const bName = (b.organizations as { name: string } | null)?.name ?? "";
      return sortDir ? aName.localeCompare(bName) : bName.localeCompare(aName);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="mt-1 text-muted-foreground">
            Create and manage assessment center projects.
          </p>
        </div>
        <Link href="/admin/engagements/new">
          <Button>+ New Project</Button>
        </Link>
      </div>

      {/* Status filter badges */}
      <EngagementStatusFilter counts={counts} activeFilter={filterStatus} />

      {/* Sorting + client filter toolbar */}
      <ProjectListToolbar
        organizations={organizations ?? []}
        currentSort={sortField}
        currentDir={searchParams.dir || "desc"}
        currentClient={clientFilter}
        currentStatus={filterStatus}
      />

      <div className="mt-4">
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">No projects yet.</p>
            <Link href="/admin/engagements/new">
              <Button variant="outline" className="mt-4">
                Create your first project
              </Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Target Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((eng) => {
                const orgName =
                  eng.organizations &&
                  typeof eng.organizations === "object" &&
                  "name" in eng.organizations
                    ? (eng.organizations as { name: string }).name
                    : "—";
                return (
                  <TableRow key={eng.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/engagements/${eng.id}`} className="hover:underline">
                        {eng.name}
                      </Link>
                    </TableCell>
                    <TableCell>{orgName}</TableCell>
                    <TableCell>{eng.target_role ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[eng.status] ?? "secondary"}>
                        {eng.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {eng.start_date ?? "—"} — {eng.end_date ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
