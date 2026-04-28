import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { BulkAssignClient } from "./_components/bulk-assign-client";

export const dynamic = "force-dynamic";

export default async function BulkAssignPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("role_profiles")
    .select("id, name_en")
    .order("name_en");

  return (
    <div className="space-y-4">
      <BackLink href="/admin/role-profiles" label="Back to Role Profiles" />
      <div>
        <h1 className="text-2xl font-bold">Bulk-Link Candidates to Role Profiles</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Upload a CSV with <code className="font-mono text-xs">email</code> and{" "}
          <code className="font-mono text-xs">role_profile_id</code> columns to
          assign existing candidates to role profiles in one step. Matching is
          by email; candidates without a matching email are skipped (and
          flagged in the result).
        </p>
      </div>
      <BulkAssignClient profiles={profiles ?? []} />
    </div>
  );
}
