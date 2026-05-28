import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ARA_INDIVIDUAL_FACTORS } from "@/lib/constants/ara-individual-factors";
import { getServerT } from "@/lib/i18n/server";
import { createDeepDivePersonalAssessment } from "./actions";
import { DeepDiveForm } from "./_components/deep-dive-form";

export const dynamic = "force-dynamic";

export default async function PersonalDeepDiveNewPage() {
  const t = await getServerT();
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link
          href="/ara/consultant"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3 w-3" /> {t("araAssessmentDetail.dd_back")}
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-accent" />
            {t("araAssessmentDetail.dd_page_title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("araAssessmentDetail.dd_page_subtitle")}
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("araAssessmentDetail.dd_measured_title")}</CardTitle>
            <CardDescription>
              {t("araAssessmentDetail.dd_measured_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {ARA_INDIVIDUAL_FACTORS.map((f) => (
              <div key={f.id} className="rounded-md border p-2.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: f.color }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {f.domain}
                  </span>
                  <span className="ms-auto text-[10px] text-muted-foreground tabular-nums">
                    {t("araAssessmentDetail.dd_items_count", { count: 12 })}
                  </span>
                </div>
                <p className="text-sm font-semibold">{f.name_en}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("araAssessmentDetail.dd_issue_card_title")}</CardTitle>
            <CardDescription>
              {t("araAssessmentDetail.dd_issue_card_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeepDiveForm action={createDeepDivePersonalAssessment} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
