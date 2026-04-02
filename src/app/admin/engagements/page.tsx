import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const STATUS_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  active: "default",
  completed: "outline",
  archived: "destructive",
};

export default async function EngagementsPage() {
  const supabase = createServiceClient();

  const { data: engagements } = await supabase
    .from("engagements")
    .select("id, name, status, target_role, start_date, end_date, organizations(name)")
    .order("created_at", { ascending: false });

  const counts = {
    all: engagements?.length ?? 0,
    draft: engagements?.filter((e) => e.status === "draft").length ?? 0,
    active: engagements?.filter((e) => e.status === "active").length ?? 0,
    completed: engagements?.filter((e) => e.status === "completed").length ?? 0,
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Engagements</h1>
          <p className="mt-1 text-muted-foreground">
            Create and manage assessment center engagements.
          </p>
        </div>
        <Link href="/admin/engagements/new">
          <Button>+ New Engagement</Button>
        </Link>
      </div>

      {/* Status filter badges */}
      <div className="mt-4 flex gap-2">
        <Badge variant="outline" className="text-xs">All ({counts.all})</Badge>
        <Badge variant="secondary" className="text-xs">Draft ({counts.draft})</Badge>
        <Badge variant="default" className="text-xs">Active ({counts.active})</Badge>
        <Badge variant="outline" className="text-xs">Completed ({counts.completed})</Badge>
      </div>

      <div className="mt-4">
        {!engagements || engagements.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">No engagements yet.</p>
            <Link href="/admin/engagements/new">
              <Button variant="outline" className="mt-4">
                Create your first engagement
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
              {engagements.map((eng) => {
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
