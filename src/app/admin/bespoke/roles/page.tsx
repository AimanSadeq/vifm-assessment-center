import { notFound } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { RolesAdminClient } from "./_components/roles-admin-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Role Readiness roles · VIFM" };

type Family = { id: string; name_en: string; name_ar: string | null };
type Role = {
  id: string;
  name_en: string;
  job_family_id: string | null;
  status: string;
  persona_pass_pct: number;
  technical_pass_pct: number;
  is_sample: boolean;
};

export default async function BespokeRolesPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) notFound();
    throw e;
  }

  const sb = createServiceClient();
  const [{ data: fams }, { data: roleRows }] = await Promise.all([
    sb.from("job_families").select("id, name_en, name_ar").order("name_en"),
    sb
      .from("rr_role_configs")
      .select("id, name_en, job_family_id, status, persona_pass_pct, technical_pass_pct, is_sample")
      .order("name_en"),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/admin/bespoke" label="Bespoke" history />
      <div>
        <h1 className="text-2xl font-bold">Role Readiness roles</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Configure a job family, then a role: pick behavioural competencies with per-competency targets, attach
          technical areas + items, set the pass thresholds, and publish it to the Bespoke Services section. No code
          changes - everything here is data-driven.
        </p>
      </div>
      <RolesAdminClient families={(fams ?? []) as Family[]} roles={(roleRows ?? []) as Role[]} />
    </div>
  );
}
