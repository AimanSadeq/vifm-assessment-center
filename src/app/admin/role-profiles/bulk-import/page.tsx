import { BackLink } from "@/components/shared/back-link";
import { BulkImportClient } from "./_components/bulk-import-client";

export const dynamic = "force-dynamic";

export default function BulkImportPage() {
  return (
    <div className="space-y-4">
      <BackLink href="/admin/role-profiles" label="Back to Role Profiles" />
      <div>
        <h1 className="text-2xl font-bold">Bulk JD Import</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Upload up to 25 job descriptions (PDF or TXT) at once. Claude extracts
          a recommended competency set per file; you review names + accept which
          to save as new role profiles.
        </p>
      </div>
      <BulkImportClient />
    </div>
  );
}
