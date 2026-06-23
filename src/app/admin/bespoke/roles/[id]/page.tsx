import { notFound } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadRoleConfig } from "@/lib/role-readiness/config";
import { loadPlatformClients } from "@/lib/clients/registry";
import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { RoleEditor } from "./_components/role-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit role · Role Readiness · VIFM" };

export default async function RoleEditorPage({ params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) notFound();
    throw e;
  }

  const config = await loadRoleConfig(params.id);
  if (!config) notFound();

  // Is it published as a bespoke service?
  const sb = createServiceClient();
  const { data: pub } = await sb
    .from("bespoke_services")
    .select("id, status, organization_id")
    .eq("role_config_id", params.id)
    .eq("kind", "role_readiness")
    .maybeSingle();
  const published = !!pub && (pub.status as string) === "active";
  const assignedOrgId = (pub?.organization_id as string | null) ?? null;

  const clients = (await loadPlatformClients())
    .filter((c) => c.acId)
    .map((c) => ({ id: c.acId as string, name: c.name }));

  return (
    <div className="space-y-6">
      <BackLink href="/admin/bespoke/roles" label="Roles" history />
      <RoleEditor config={config} published={published} clients={clients} assignedOrgId={assignedOrgId} />
    </div>
  );
}
