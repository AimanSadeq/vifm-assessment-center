import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus } from "lucide-react";
import type { AraOrganization } from "@/types/ara";

export default async function AraOrganizationsPage() {
  const t = await getServerT();
  const sb = createServiceClient();
  const { data: orgs } = await sb
    .from("ara_organizations")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<AraOrganization[]>();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/ara/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> {t("araAdmin.orgsBackToAdmin")}
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-primary">{t("araAdmin.orgsTitle")}</h1>
            <p className="text-muted-foreground">
              {t("araAdmin.orgsSubtitle")}
            </p>
          </div>
          <Link href="/ara/admin/organizations/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> {t("araAdmin.orgsNewButton")}
            </Button>
          </Link>
        </div>

        {!orgs || orgs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">{t("araAdmin.orgsEmptyTitle")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("araAdmin.orgsEmptyBody")}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("araAdmin.orgsColName")}</TableHead>
                <TableHead>{t("araAdmin.orgsColNameAr")}</TableHead>
                <TableHead>{t("araAdmin.orgsColRegion")}</TableHead>
                <TableHead>{t("araAdmin.orgsColSector")}</TableHead>
                <TableHead>{t("araAdmin.orgsColCreated")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">
                    <Link href={`/ara/admin/organizations/${org.id}`} className="hover:underline">
                      {org.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground" dir="rtl">
                    {org.name_ar ?? "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={org.region === "uae" ? "default" : "secondary"}>
                      {org.region === "uae" ? t("araAdmin.regionUae") : t("araAdmin.regionSaudi")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {org.sector}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(org.created_at).toLocaleDateString()}
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
