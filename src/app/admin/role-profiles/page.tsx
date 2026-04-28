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
import { Plus, Sparkles, Globe, Building2, Users, FileUp } from "lucide-react";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  name_en: string;
  name_ar: string | null;
  target_role: string | null;
  industry: string | null;
  region: string | null;
  organization_id: string | null;
  organizations: { name: string } | null;
  role_profile_competencies: { count: number }[];
};

export default async function RoleProfilesListPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("role_profiles")
    .select(
      "id, name_en, name_ar, target_role, industry, region, organization_id, organizations(name), role_profile_competencies(count)"
    )
    .order("name_en");

  const profiles = (data ?? []) as unknown as ProfileRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Role Profiles</h1>
          <p className="mt-1 text-muted-foreground text-sm max-w-2xl">
            Reusable competency packs tied to common roles. Pick a profile when
            creating a new engagement to pre-fill Step&nbsp;2 with the right
            competencies, weights, and priorities.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/role-profiles/bulk-import">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileUp className="h-3.5 w-3.5" />
              Bulk JD import
            </Button>
          </Link>
          <Link href="/admin/role-profiles/bulk-assign">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Bulk-Link candidates
            </Button>
          </Link>
          <Link href="/admin/role-profiles/new">
            <Button>
              <Plus className="h-4 w-4 me-1.5" />
              New role profile
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">
              Could not load role profiles: {error.message}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Did you run <code className="font-mono">npx supabase db push</code> after
              adding migrations <code>00014</code> and <code>00015</code>?
            </p>
          </CardContent>
        </Card>
      )}

      {!error && profiles.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No role profiles yet</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              The seed migration ships 6 GCC banking + government profiles. Run the
              migrations or create one from a job description.
            </p>
            <Link href="/admin/role-profiles/new">
              <Button className="mt-2">
                <Plus className="h-4 w-4 me-1.5" />
                Create from JD
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!error && profiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Library ({profiles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Industry / Region</TableHead>
                  <TableHead className="text-center">Competencies</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => {
                  const compCount = p.role_profile_competencies?.[0]?.count ?? 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div>
                          <Link
                            href={`/admin/role-profiles/${p.id}`}
                            className="font-medium hover:underline"
                          >
                            {p.name_en}
                          </Link>
                          {p.name_ar && (
                            <p className="text-xs text-muted-foreground" dir="rtl">
                              {p.name_ar}
                            </p>
                          )}
                          {p.target_role && p.target_role !== p.name_en && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {p.target_role}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.organization_id ? (
                          <Badge variant="outline" className="gap-1">
                            <Building2 className="h-3 w-3" />
                            {p.organizations?.name ?? "Org-scoped"}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Globe className="h-3 w-3" />
                            VIFM library
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1.5">
                          {p.industry && (
                            <Badge variant="outline" className="text-xs">
                              {p.industry}
                            </Badge>
                          )}
                          {p.region && (
                            <Badge variant="outline" className="text-xs uppercase">
                              {p.region}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={compCount >= 4 ? "default" : "destructive"}>
                          {compCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/role-profiles/${p.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
