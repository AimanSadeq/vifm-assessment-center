import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VifmLogo } from "@/components/shared/vifm-logo";
import {
  loadRespondentByToken, loadQuestionsForRespondent,
} from "@/lib/ara/respondent-access";
import { touchAraRespondent, markAraRespondentComplete } from "@/lib/ara/respondent-actions";
import { QuestionsForm, CompleteButton } from "./_components/questions-form";
import { LanguageToggle } from "./_components/language-toggle";
import { MaterialsSection } from "./_components/materials-section";
import { UseCasesSection } from "./_components/use-cases-section";
import { OfflineBanner } from "./_components/offline-banner";

export const dynamic = "force-dynamic";

export default async function AraRespondPage({
  params,
}: {
  params: { token: string };
}) {
  const ctx = await loadRespondentByToken(params.token);
  if (!ctx) return notFound();

  // Update first_opened_at / last_active_at. Must happen before we render.
  await touchAraRespondent(params.token);

  // Refetch to get the up-to-date language_preference after the touch.
  const sb = createServiceClient();
  const { data: refreshed } = await sb
    .from("ara_respondents")
    .select("language_preference, completed_at")
    .eq("id", ctx.respondent.id)
    .maybeSingle<{ language_preference: "en" | "ar"; completed_at: string | null }>();

  const language = refreshed?.language_preference ?? ctx.respondent.language_preference;
  const rtl = language === "ar";
  const completed = !!refreshed?.completed_at;

  const questions = await loadQuestionsForRespondent(ctx);

  const { data: answers } = await sb
    .from("ara_responses")
    .select("question_id, answer_value, answer_text, needs_verification")
    .eq("respondent_id", ctx.respondent.id);

  const { data: materials } = await sb
    .from("ara_supporting_materials")
    .select("id, material_type, material_name, file_name, link_url")
    .eq("respondent_id", ctx.respondent.id)
    .order("uploaded_at", { ascending: false });

  const { data: useCases } = await sb
    .from("ara_use_cases")
    .select("id, name, stage, pillar_id, risk_level, value_level, business_owner")
    .eq("respondent_id", ctx.respondent.id)
    .order("created_at", { ascending: false });

  const completeAction = async () => {
    "use server";
    await markAraRespondentComplete(params.token);
  };

  const orgName = rtl
    ? ctx.assessment.organization?.name_ar ?? ctx.assessment.organization?.name
    : ctx.assessment.organization?.name;

  return (
    <div className="min-h-screen bg-background" dir={rtl ? "rtl" : "ltr"}>
      <OfflineBanner language={language} />

      {/* ─── Hero welcome ─── */}
      <section className="ara-hero relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-6 pt-8 pb-14">
          <div className="flex items-start justify-between gap-4 mb-10">
            <VifmLogo variant="white" size="md" />
            <LanguageToggle token={params.token} current={language} />
          </div>

          {ctx.assessment.is_sandbox && (
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-300/30 px-3 py-1 text-xs text-amber-200">
              <FlaskConical className="h-3 w-3" />
              <span>{rtl ? "تقييم تجريبي" : "Test assessment"}</span>
            </div>
          )}

          <span className="ara-eyebrow text-accent">
            {rtl ? "تقييم الاستعداد للذكاء الاصطناعي" : "AI Readiness Assessment"}
          </span>
          <h1 className="ara-numeral text-3xl sm:text-4xl font-semibold text-white mt-3 mb-2 leading-tight">
            {rtl
              ? `مرحباً ${ctx.respondent.name_ar ?? ctx.respondent.name}`
              : `Welcome, ${ctx.respondent.name}`}
          </h1>
          <p className="text-base text-white/75 max-w-xl">
            {orgName ? (
              rtl ? (
                <>
                  أنت تساهم في تقييم{" "}
                  <span className="text-white font-medium">{orgName}</span>.
                </>
              ) : (
                <>
                  You're contributing to the AI readiness assessment for{" "}
                  <span className="text-white font-medium">{orgName}</span>.
                </>
              )
            ) : null}
          </p>
          <p className="text-sm text-white/60 mt-4 max-w-xl">
            {rtl
              ? "إجاباتك محفوظة تلقائياً. يمكنك إغلاق الصفحة والعودة في أي وقت لإكمال التقييم."
              : "Your answers save automatically. Close this page and come back anytime to finish."}
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6 -mt-8 relative z-10">

        {/* Questions form */}
        <QuestionsForm
          token={params.token}
          questions={questions}
          answers={(answers ?? []).map((a) => ({
            question_id: a.question_id,
            answer_value: a.answer_value,
            answer_text: a.answer_text,
            needs_verification: a.needs_verification ?? false,
          }))}
          language={language}
        />

        {/* AI Use Case Portfolio (optional) */}
        <UseCasesSection
          token={params.token}
          language={language}
          useCases={(useCases ?? []) as any}
        />

        {/* Supporting Materials (optional) */}
        <MaterialsSection
          token={params.token}
          language={language}
          materials={(materials ?? []).map((m) => ({
            id: m.id,
            material_type: m.material_type,
            material_name: m.material_name,
            file_name: m.file_name,
            link_url: m.link_url,
          }))}
        />

        {/* Complete button */}
        {questions.length > 0 && (
          <CompleteButton
            token={params.token}
            alreadyComplete={completed}
            language={language}
            onComplete={completeAction}
          />
        )}
      </div>
    </div>
  );
}
