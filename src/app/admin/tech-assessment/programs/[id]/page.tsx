export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/shared/back-link";
import { getServerT, getServerLocale } from "@/lib/i18n/server";
import { getTechnicalProgram } from "@/lib/competencies/technical-program";
import { ProgramDetail } from "../_components/program-detail";

export default async function TechnicalProgramDetailPage({ params }: { params: { id: string } }) {
  const t = await getServerT();
  const full = await getTechnicalProgram(params.id, await getServerLocale());
  if (!full) notFound();

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
      <BackLink href="/admin/tech-assessment/programs" label={t("techProg.title")} />

      <div>
        <h1 className="text-2xl font-bold text-[#010131]">{full.meta.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {full.meta.organizationName}</span>
          <Badge variant="secondary">{tierLabel(full.meta.tier)}</Badge>
          <Badge variant="outline" className="capitalize">{statusLabel(full.meta.status)}</Badge>
        </div>
      </div>

      <ProgramDetail programId={full.meta.id} program={full.program} participants={full.participants} />
    </div>
  );
}
