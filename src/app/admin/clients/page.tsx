import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function ClientsPage() {
  const supabase = await createClient();
  const t = await getServerT();

  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name, industry, country, contact_name, contact_email")
    .order("name");

  // Count engagements per org
  const { data: engagements } = await supabase
    .from("engagements")
    .select("organization_id");

  const countMap = new Map<string, number>();
  (engagements ?? []).forEach((e) => {
    countMap.set(e.organization_id, (countMap.get(e.organization_id) ?? 0) + 1);
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("adminClients.title")}</h1>
      <p className="mt-1 text-muted-foreground">
        {t("adminClients.subtitle")}
      </p>

      <div className="mt-6">
        {(!organizations || organizations.length === 0) ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">{t("adminClients.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("adminClients.emptyBody")}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("adminClients.colOrganization")}</TableHead>
                <TableHead>{t("adminClients.colIndustry")}</TableHead>
                <TableHead>{t("adminClients.colCountry")}</TableHead>
                <TableHead>{t("adminClients.colContact")}</TableHead>
                <TableHead>{t("adminClients.colEngagements")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell>{org.industry ?? "-"}</TableCell>
                  <TableCell>{org.country ?? "-"}</TableCell>
                  <TableCell>
                    {org.contact_name ? (
                      <div>
                        <p className="text-sm">{org.contact_name}</p>
                        {org.contact_email && (
                          <p className="text-xs text-muted-foreground">{org.contact_email}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("adminClients.notSet")}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{countMap.get(org.id) ?? 0}</Badge>
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
