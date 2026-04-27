import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function AssessorsPage() {
  const supabase = await createClient();

  const { data: assessors } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, phone")
    .in("role", ["lead_assessor", "associate_assessor"])
    .order("full_name");

  // Count assignments per assessor
  const { data: assignments } = await supabase
    .from("assessor_assignments")
    .select("assessor_id");

  const countMap = new Map<string, number>();
  (assignments ?? []).forEach((a) => {
    countMap.set(a.assessor_id, (countMap.get(a.assessor_id) ?? 0) + 1);
  });

  // Count ratings per assessor
  const { data: ratings } = await supabase
    .from("ratings")
    .select("assessor_assignment_id, assessor_assignments(assessor_id)");

  const ratingCountMap = new Map<string, number>();
  (ratings ?? []).forEach((r) => {
    const a = r.assessor_assignments as unknown as { assessor_id: string } | null;
    if (a) ratingCountMap.set(a.assessor_id, (ratingCountMap.get(a.assessor_id) ?? 0) + 1);
  });

  const ROLE_LABELS: Record<string, string> = {
    lead_assessor: "Lead Assessor",
    associate_assessor: "Associate Assessor",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Assessors</h1>
      <p className="mt-1 text-muted-foreground">
        Manage assessor pool, certifications, and assignments.
      </p>

      <div className="mt-6">
        {(!assessors || assessors.length === 0) ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">No assessors registered yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Assessors are created when assigning them to engagements.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assignments</TableHead>
                <TableHead>Ratings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessors.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/assessors/${a.id}`} className="hover:underline text-primary">
                      {a.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROLE_LABELS[a.role] ?? a.role}</Badge>
                  </TableCell>
                  <TableCell>{countMap.get(a.id) ?? 0}</TableCell>
                  <TableCell>{ratingCountMap.get(a.id) ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
