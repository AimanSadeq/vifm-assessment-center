import { getServerT } from "@/lib/i18n/server";
import { BackLink } from "@/components/shared/back-link";
import { BulkImportClient } from "./_components/bulk-import-client";

export const dynamic = "force-dynamic";

export default async function BulkImportPage() {
  const t = await getServerT();
  return (
    <div className="space-y-4">
      <BackLink href="/admin/role-profiles" label={t("adminRoleProfiles.backToList")} />
      <div>
        <h1 className="text-2xl font-bold">{t("adminRoleProfiles.bulkImport.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {t("adminRoleProfiles.bulkImport.subtitle")}
        </p>
      </div>
      <BulkImportClient />
    </div>
  );
}
