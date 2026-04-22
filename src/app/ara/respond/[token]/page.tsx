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
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <VifmLogo variant="color" size="md" />
          <LanguageToggle token={params.token} current={language} />
        </div>

        {ctx.assessment.is_sandbox && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-center gap-2 text-amber-900 text-sm">
            <FlaskConical className="h-4 w-4" />
            <span>
              {rtl ? "هذا تقييم تجريبي" : "This is a test assessment"}
            </span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {rtl ? "تقييم الاستعداد للذكاء الاصطناعي" : "AI Readiness Assessment"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {orgName ?? "—"}
            </p>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              {rtl
                ? `مرحباً ${ctx.respondent.name_ar ?? ctx.respondent.name}. لقد تم تعيينك للأقسام التالية:`
                : `Welcome ${ctx.respondent.name}. You've been assigned the following sections:`}
            </p>
            <p className="text-xs">
              {rtl
                ? "إجاباتك محفوظة تلقائياً. يمكنك العودة لاحقاً لإكمال التقييم."
                : "Your answers are saved automatically. You can return anytime to finish."}
            </p>
          </CardContent>
        </Card>

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
