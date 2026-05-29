import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, UserSearch } from "lucide-react";

export const dynamic = "force-dynamic";

type ReqRow = {
  id: string;
  title: string;
  level: string | null;
  status: string;
  organization_id: string | null;
  organizations: { name: string } | null;
  prehire_candidates: { count: number }[];
};

export default async function PreHireListPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prehire_requisitions")
    .select(
      "id, title, level, status, organization_id, organizations(name), prehire_candidates(count)"
    )
    .order("created_at", { ascending: false });

  const reqs = (data ?? []) as unknown as ReqRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pre-Hire Requisitions</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Pre-employment screening pipelines run for client organizations. Each
            requisition defines the role, the screening stages, and the cut-scores.
          </p>
        </div>
        <Link href="/admin/prehire/new">
          <Button>
            <Plus className="h-4 w-4 me-1.5" />
            New requisition
          </Button>
        </Link>
      </div>

      {error && (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">
              Couldn&apos;t load requisitions: {error.message}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Have you run <code className="font-mono">npx supabase db push</code> to apply
              migration <code>00050</code>?
            </p>
          </CardContent>
        </Card>
      )}

      {!error && reqs.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <UserSearch className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No requisitions yet</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Create a requisition to start screening candidates for a client role.
            </p>
            <Link href="/admin/prehire/new">
              <Button className="mt-2">
                <Plus className="h-4 w-4 me-1.5" />
                New requisition
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!error && reqs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {reqs.length} requisition{reqs.length === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-center">Candidates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reqs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        href={`/admin/prehire/${r.id}`}
                        className="font-medium hover:underline"
                      >
                        {r.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.organizations?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{r.level ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      {r.prehire_candidates?.[0]?.count ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <Link href={`/admin/prehire/${r.id}`}>
                        <Button variant="ghost" size="sm">
                          Open
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
