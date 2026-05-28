import Link from "next/link";
import { ArrowLeft, FlaskConical, AlertTriangle } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { clearAraSandboxData } from "@/lib/ara/admin-actions";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AraSandboxPage() {
  const sb = createServiceClient();
  const t = await getServerT();
  const { data: sandboxes } = await sb
    .from("ara_assessments")
    .select("id, created_at, region, sector, status, organization:ara_organizations(name)")
    .eq("is_sandbox", true)
    .order("created_at", { ascending: false });

  const list = (sandboxes ?? []) as unknown as Array<{
    id: string;
    created_at: string;
    region: string;
    sector: string;
    status: string;
    organization: { name: string } | null;
  }>;

  const clearAction = async (fd: FormData) => {
    "use server";
    await clearAraSandboxData(fd);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/ara/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> {t("araAdminData.back_to_ara_admin")}
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <FlaskConical className="h-5 w-5 text-amber-600" />
          <h1 className="text-2xl font-semibold text-primary">{t("araAdminData.sb_title")}</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          {t("araAdminData.sb_subtitle")}
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t("araAdminData.sb_current_title")}</CardTitle>
            <CardDescription>{t(list.length === 1 ? "araAdminData.sb_current_desc_one" : "araAdminData.sb_current_desc_other", { count: list.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("araAdminData.sb_none")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("araAdminData.sb_col_organization")}</TableHead>
                    <TableHead>{t("araAdminData.sb_col_region")}</TableHead>
                    <TableHead>{t("araAdminData.sb_col_sector")}</TableHead>
                    <TableHead>{t("araAdminData.sb_col_status")}</TableHead>
                    <TableHead>{t("araAdminData.sb_col_created")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.organization?.name ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant={s.region === "uae" ? "default" : "secondary"}>
                          {s.region === "uae" ? t("araAdminData.sb_region_uae") : t("araAdminData.sb_region_saudi")}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{s.sector}</TableCell>
                      <TableCell className="capitalize">{s.status}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {t("araAdminData.sb_clear_title")}
            </CardTitle>
            <CardDescription>
              {t("araAdminData.sb_clear_desc_prefix")}
              <strong> {t("araAdminData.sb_clear_desc_bold")}</strong> {t("araAdminData.sb_clear_desc_suffix")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={clearAction} className="flex items-end gap-3">
              <div className="space-y-1 flex-1 max-w-md">
                <Label htmlFor="confirmation" className="text-xs">
                  {t("araAdminData.sb_confirm_label_prefix")} <code>DELETE SANDBOX DATA</code> {t("araAdminData.sb_confirm_label_suffix")}
                </Label>
                <Input
                  id="confirmation"
                  name="confirmation"
                  required
                  placeholder="DELETE SANDBOX DATA"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" variant="destructive" disabled={list.length === 0}>
                {t(list.length === 1 ? "araAdminData.sb_delete_button_one" : "araAdminData.sb_delete_button_other", { count: list.length })}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
