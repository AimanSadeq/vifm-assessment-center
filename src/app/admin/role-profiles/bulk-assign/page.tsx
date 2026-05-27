import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { BackLink } from "@/components/shared/back-link";
import { BulkAssignClient } from "./_components/bulk-assign-client";

export const dynamic = "force-dynamic";

export default async function BulkAssignPage() {
  const supabase = await createClient();
  const t = await getServerT();
  const { data: profiles } = await supabase
    .from("role_profiles")
    .select("id, name_en")
    .order("name_en");

  return (
    <div className="space-y-4">
      <BackLink href="/admin/role-profiles" label={t("adminRoleProfiles.backToList")} />
      <div>
        <h1 className="text-2xl font-bold">{t("adminRoleProfiles.bulkAssign.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {t("adminRoleProfiles.bulkAssign.subtitleBefore")}{" "}
          <code className="font-mono text-xs">email</code>{" "}
          {t("adminRoleProfiles.and")}{" "}
          <code className="font-mono text-xs">role_profile_id</code>{" "}
          {t("adminRoleProfiles.bulkAssign.subtitleAfter")}
        </p>
      </div>
      <BulkAssignClient profiles={profiles ?? []} />
    </div>
  );
}
