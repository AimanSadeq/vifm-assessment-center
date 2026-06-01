export const dynamic = "force-dynamic";

import { Layers3 } from "lucide-react";
import { BackLink } from "@/components/shared/back-link";
import { getServerT, getServerLocale } from "@/lib/i18n/server";
import { isAIConfigured } from "@/lib/ai/client";
import {
  listTechnicalFunctions,
  categoryLabel,
  TECH_FUNCTION_CATEGORIES,
} from "@/lib/competencies/technical-function";
import { FunctionsClient } from "./_components/functions-client";

export default async function TechnicalFunctionsPage() {
  const t = await getServerT();
  const locale = await getServerLocale();
  const functions = await listTechnicalFunctions(locale);
  const categories = TECH_FUNCTION_CATEGORIES.map((value) => ({ value, label: categoryLabel(value, locale) }));

  return (
    <div className="space-y-6">
      <BackLink href="/admin/tech-assessment" label={t("tech.cmd.title")} />

      <div className="rounded-md border bg-gradient-to-r from-[#0c2a4d] to-[#114b7a] p-5 text-white">
        <div className="flex items-start gap-3">
          <Layers3 className="h-8 w-8 shrink-0 text-sky-200" />
          <div>
            <h1 className="text-2xl font-bold leading-tight">{t("techFn.title")}</h1>
            <p className="mt-1 max-w-2xl text-sm text-sky-50/90">{t("techFn.intro")}</p>
          </div>
        </div>
      </div>

      <FunctionsClient functions={functions} categories={categories} aiOn={isAIConfigured()} />
    </div>
  );
}
