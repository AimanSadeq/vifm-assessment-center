export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { Layers3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/shared/back-link";
import { getServerT, getServerLocale } from "@/lib/i18n/server";
import { isAIConfigured } from "@/lib/ai/client";
import { getTechnicalFunctionByRef } from "@/lib/competencies/technical-function";
import {
  functionBankReadiness,
  listFunctionBankItems,
  getFunctionCutScore,
} from "@/lib/competencies/technical-function-bank";
import { CertWorkbench } from "../_components/cert-workbench";

export default async function FunctionCertPage({ params }: { params: { ref: string } }) {
  const t = await getServerT();
  const locale = await getServerLocale();
  const fn = await getTechnicalFunctionByRef(decodeURIComponent(params.ref), locale);
  if (!fn) notFound();

  const [readiness, items, cut] = await Promise.all([
    functionBankReadiness(fn.skillsEn, fn.id),
    listFunctionBankItems(fn.skillsEn),
    getFunctionCutScore(fn.id),
  ]);

  return (
    <div className="space-y-6">
      <BackLink href="/admin/tech-assessment/functions" label={t("techFn.title")} />

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#010131]">
          <Layers3 className="h-6 w-6 text-[#5391D5]" /> {fn.name}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{fn.categoryLabel}</Badge>
          <Badge variant="outline">{fn.source === "jd" ? t("techFn.customBadge") : t("techFn.standardBadge")}</Badge>
          <span>{t("techFn.skillsN", { n: fn.skillsEn.length })}</span>
        </div>
      </div>

      <CertWorkbench
        fn={{ ref: fn.ref, id: fn.id, name: fn.name, skillsEn: fn.skillsEn, skills: fn.skills }}
        readiness={readiness}
        items={items}
        cut={cut}
        aiOn={isAIConfigured()}
      />
    </div>
  );
}
