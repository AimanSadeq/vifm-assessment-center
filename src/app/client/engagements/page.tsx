export const dynamic = "force-dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ClientEngagementsPage() {
  const supabase = await createClient();

  const orgId = await getClientOrgId();
  let query = supabase
    .from("engagements")
    .select("id, name, status, target_role, start_date, end_date, organizations(name)")
    .order("created_at", { ascending: false });
  if (orgId) query = query.eq("organization_id", orgId);
  const { data: engagements } = await query;

  // Get candidate counts per engagement
  const { data: candidates } = await supabase
    .from("candidates")
    .select("engagement_id");

  const countMap = new Map<string, number>();
  for (const c of candidates ?? []) {
    countMap.set(c.engagement_id, (countMap.get(c.engagement_id) ?? 0) + 1);
  }

  const STATUS_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    draft: "secondary",
    active: "default",
    completed: "outline",
    archived: "destructive",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Projects</h1>
      <p className="mt-1 text-muted-foreground">
        View your assessment center projects and timelines.
      </p>

      <div className="mt-6">
        {(!engagements || engagements.length === 0) ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No engagements available.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Target Role</TableHead>
                <TableHead>Candidates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {engagements.map((eng) => (
                <TableRow key={eng.id}>
                  <TableCell className="font-medium">
                    <Link href={`/client/engagements/${eng.id}`} className="hover:underline">
                      {eng.name}
                    </Link>
                  </TableCell>
                  <TableCell>{eng.target_role ?? "-"}</TableCell>
                  <TableCell>{countMap.get(eng.id) ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[eng.status] ?? "secondary"}>
                      {eng.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {eng.start_date ?? "-"} - {eng.end_date ?? "-"}
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
