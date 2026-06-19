export const dynamic = "force-dynamic";

import { getServerT } from "@/lib/i18n/server";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { loadPlatformClients } from "@/lib/clients/registry";
import { CreateClientDialog } from "./_components/create-client-dialog";
import { BackLink } from "@/components/shared/back-link";

const SECTOR_LABEL: Record<string, string> = { government: "Government", banking: "Banking", general: "General" };
const REGION_LABEL: Record<string, string> = { uae: "UAE", saudi: "Saudi Arabia" };

export default async function ClientsPage() {
  const t = await getServerT();
  const clients = await loadPlatformClients();

  return (
    <div>
      <BackLink href="/admin" label="Back" history />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("adminClients.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("adminClients.subtitle")}</p>
        </div>
        <CreateClientDialog />
      </div>

      <div className="mt-6">
        {clients.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">{t("adminClients.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Use <span className="font-medium">Add Client</span> to create one - it&apos;s saved once and connected across every service.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("adminClients.colOrganization")}</TableHead>
                <TableHead>{t("adminClients.colIndustry")}</TableHead>
                <TableHead>{t("adminClients.colCountry")}</TableHead>
                <TableHead>Connected services</TableHead>
                <TableHead>{t("adminClients.colEngagements")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.key}>
                  <TableCell className="font-medium">
                    {c.name}
                    {c.region && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {REGION_LABEL[c.region]}{c.sector ? ` · ${SECTOR_LABEL[c.sector]}` : ""}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{c.industry ?? "-"}</TableCell>
                  <TableCell>{c.country ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.acId ? (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">AC · Pre-Hire</Badge>
                      ) : null}
                      {c.araId ? (
                        <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100">AI Readiness · Reflect</Badge>
                      ) : null}
                      {!c.acId && (
                        <Badge variant="outline" className="border-dashed text-muted-foreground">AC: not linked</Badge>
                      )}
                      {!c.araId && (
                        <Badge variant="outline" className="border-dashed text-muted-foreground">ARC: not linked</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{c.engagementCount}</Badge>
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
