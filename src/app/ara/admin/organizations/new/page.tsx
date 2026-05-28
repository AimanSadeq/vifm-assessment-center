import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAraOrganization } from "@/lib/ara/actions";
import { getServerT } from "@/lib/i18n/server";

export default async function NewAraOrganizationPage() {
  const t = await getServerT();
  const createAction = async (fd: FormData) => {
    "use server";
    await createAraOrganization(fd);
  };
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/ara/admin/organizations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> {t("araAdmin.orgFormBackToOrgs")}
        </Link>

        <h1 className="text-2xl font-semibold text-primary mb-1">{t("araAdmin.orgNewTitle")}</h1>
        <p className="text-muted-foreground mb-8">
          {t("araAdmin.orgNewSubtitle")}
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("araAdmin.orgFormCardTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createAction} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">{t("araAdmin.orgFieldNameEn")} *</Label>
                <Input id="name" name="name" required maxLength={200} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name_ar">{t("araAdmin.orgFieldNameAr")}</Label>
                <Input id="name_ar" name="name_ar" maxLength={200} dir="rtl" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">{t("araAdmin.orgFieldRegion")} *</Label>
                <select
                  id="region"
                  name="region"
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>{t("araAdmin.orgRegionPlaceholder")}</option>
                  <option value="uae">{t("araAdmin.regionUaeFull")}</option>
                  <option value="saudi">{t("araAdmin.regionSaudi")}</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {t("araAdmin.orgRegionHint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sector">{t("araAdmin.orgFieldSector")} *</Label>
                <select
                  id="sector"
                  name="sector"
                  required
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>{t("araAdmin.orgSectorPlaceholder")}</option>
                  <option value="government">{t("araAdmin.sectorGovernment")}</option>
                  <option value="banking">{t("araAdmin.sectorBanking")}</option>
                  <option value="general">{t("araAdmin.sectorGeneral")}</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit">{t("araAdmin.orgCreateButton")}</Button>
                <Link href="/ara/admin/organizations">
                  <Button type="button" variant="outline">{t("araAdmin.cancel")}</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
