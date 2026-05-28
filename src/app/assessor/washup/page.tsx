import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function WashupListPage() {
  const supabase = await createClient();
  const t = await getServerT();

  const { data: engagements } = await supabase
    .from("engagements")
    .select("id, name, status, target_role, organizations(name)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <div>
      <BackLink href="/assessor" label={t("assessorWashup.list.backToMissionBoard")} />
      <h1 className="mt-2 text-2xl font-bold">{t("assessorWashup.list.title")}</h1>
      <p className="mt-2 text-muted-foreground">
        {t("assessorWashup.list.subtitle")}
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(!engagements || engagements.length === 0) ? (
          <p className="text-sm text-muted-foreground col-span-full py-8 text-center">
            {t("assessorWashup.list.empty")}
          </p>
        ) : (
          engagements.map((eng) => {
            const orgName =
              eng.organizations &&
              typeof eng.organizations === "object" &&
              "name" in eng.organizations
                ? (eng.organizations as { name: string }).name
                : "-";

            return (
              <Link key={eng.id} href={`/assessor/washup/${eng.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{eng.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{orgName}</span>
                      <Badge variant="secondary">{eng.status}</Badge>
                    </div>
                    {eng.target_role && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("assessorWashup.list.target", { role: eng.target_role })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
