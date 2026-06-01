export const dynamic = "force-dynamic";

import Link from "next/link";
import { Award, ArrowRight, Building2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/shared/back-link";
import { getServerT } from "@/lib/i18n/server";
import { listTechnicalPrograms } from "@/lib/competencies/technical-program";
import { CreateProgramForm } from "./_components/create-program-form";

export default async function TechnicalProgramsPage() {
  const t = await getServerT();
  const programs = await listTechnicalPrograms();
  const tierLabel = (k: string) => {
    const v = t(`techProg.tiers.${k}`);
    return v.startsWith("techProg.tiers.") ? k : v;
  };
  const statusLabel = (k: string) => {
    const v = t(`techProg.status.${k}`);
    return v.startsWith("techProg.status.") ? k : v;
  };

  return (
    <div className="space-y-6">
      <BackLink href="/admin/tech-assessment" label={t("tech.cmd.title")} />

      <div className="rounded-md border bg-gradient-to-r from-[#4c0519] to-[#881337] p-5 text-white">
        <div className="flex items-start gap-3">
          <Award className="h-8 w-8 shrink-0 text-rose-200" />
          <div>
            <h1 className="text-2xl font-bold leading-tight">{t("techProg.title")}</h1>
            <p className="mt-1 max-w-2xl text-sm text-rose-50/90">{t("techProg.intro")}</p>
          </div>
        </div>
      </div>

      <CreateProgramForm />

      {programs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{t("techProg.empty")}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => (
            <Link key={p.id} href={`/admin/tech-assessment/programs/${p.id}`} className="block h-full">
              <div className="flex h-full flex-col rounded-xl border p-4 transition-colors hover:border-[#5391D5] hover:bg-[#5391D5]/5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="font-semibold text-[#010131]">{p.name}</span>
                  <Badge variant="outline" className="shrink-0 capitalize">{statusLabel(p.status)}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {p.organizationName}</span>
                  <Badge variant="secondary" className="text-[10px]">{tierLabel(p.tier)}</Badge>
                </div>
                <div className="mt-4 flex flex-1 items-end justify-between text-sm">
                  <span className="inline-flex items-center gap-1.5 text-[#010131]">
                    <Users className="h-4 w-4 text-[#5391D5]" />
                    <span className="font-semibold tabular-nums">{p.participantCount}</span>
                    <span className="text-muted-foreground">{t("techProg.participants")} · {p.domainCount} {t("techProg.domains")}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-[#5391D5]" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
