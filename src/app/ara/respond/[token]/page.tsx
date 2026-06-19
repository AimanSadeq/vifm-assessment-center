import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { FlaskConical, ArrowLeft } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { validateTalentLens } from "@/lib/constants/ara-individual-factors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { AnimatedCompass } from "@/components/shared/ara/animated-compass";
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

// NOTE on the "every screen needs a back affordance" SOP: this is a token-gated,
// magic-link respondent flow with no parent screen to return to - the respondent
// arrives from an email link and a "back" would only abandon a partially-saved
// assessment (re-entry is token-only). A back link is therefore intentionally
// omitted here, consistent with the other token assessment runners.
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

  // Personal / individual stage gets its own results layout - redirect
  // straight there once they've completed. The org-side respondent flow
  // continues to render its own thank-you state.
  if (completed && ctx.assessment.engagement_stage === "individual") {
    redirect(`/ara/personal/results/${params.token}`);
  }

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

  // Lens-aware route back to the ARC landing (Selection / Development). Gives a
  // hiring manager running the assessment themselves a one-click way home, and
  // satisfies the "every screen needs a back affordance" SOP.
  const lens = validateTalentLens(ctx.assessment.talent_lens);
  const backHref = lens ? `/ara?lens=${lens}` : "/ara";

  return (
    <div className="min-h-screen bg-background" dir={rtl ? "rtl" : "ltr"}>
      <OfflineBanner language={language} />

      {/* ─── Hero welcome ─── */}
      <section className="ara-hero relative overflow-hidden">
        {/* Decorative compass watermark - bottom-right, muted.
            Hidden on small screens so it never crowds the form. */}
        <div
          className={`pointer-events-none hidden md:block absolute bottom-0 ${rtl ? "left-0" : "right-0"} w-[280px] h-[280px] opacity-60 translate-x-8 translate-y-8`}
          aria-hidden="true"
        >
          <AnimatedCompass className="w-full h-full" />
        </div>

        <div className="max-w-3xl mx-auto px-6 pt-8 pb-14 relative z-10">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white mb-6"
          >
            <ArrowLeft className={`h-3 w-3 ${rtl ? "rotate-180" : ""}`} />
            {rtl ? "العودة إلى بوصلة الجاهزية للذكاء الاصطناعي" : "Back to the AI Readiness Compass"}
          </Link>
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
            {rtl ? "بوصلة الاستعداد للذكاء الاصطناعي" : "AI Readiness Compass"}
          </span>
          <h1 className="ara-numeral text-3xl sm:text-4xl font-semibold text-white mt-3 mb-2 leading-tight">
            {rtl
              ? `مرحباً ${ctx.respondent.name_ar ?? ctx.respondent.name}`
              : `Welcome, ${ctx.respondent.name}`}
          </h1>
          <p className="text-base text-white/75 max-w-xl">
            {ctx.assessment.engagement_stage === "individual" ? (
              rtl ? (
                "أنت تأخذ تقييم الجاهزية الشخصية للذكاء الاصطناعي."
              ) : (
                "You're taking the Personal AI Readiness assessment."
              )
            ) : orgName ? (
              rtl ? (
                <>
                  أنت تساهم في تقييم{" "}
                  <span className="text-white font-medium">{orgName}</span>.
                </>
              ) : (
                <>
                  You&apos;re contributing to the AI readiness assessment for{" "}
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

        {/* Questions form. Strip the answer key (score_map) + evidence rationale
            before it reaches the browser - graded items (situational_judgment /
            knowledge_check) must never expose their correct answer client-side.
            Scoring re-fetches score_map server-side in saveAraAnswer. */}
        {/* The optional sections + Submit button are passed as children so
            QuestionsForm can gate them behind its internal `started` state -
            none of this should appear on the pre-start intro/landing screen
            (the stray "Submit assessment" button under Start was the bug). */}
        <QuestionsForm
          token={params.token}
          questions={questions.map((q) => ({ ...q, score_map: null, validation_evidence: null }))}
          answers={(answers ?? []).map((a) => ({
            question_id: a.question_id,
            answer_value: a.answer_value,
            answer_text: a.answer_text,
            needs_verification: a.needs_verification ?? false,
          }))}
          language={language}
          timeLimitMinutes={ctx.assessment.time_limit_minutes ?? null}
          startedAt={ctx.respondent.started_at ?? null}
          isSandbox={ctx.assessment.is_sandbox}
          backHref={backHref}
        >
          <div className="space-y-6">
            {/* AI Use Case Portfolio (optional) - org-side only. Personal /
                 individual-stage respondents (Mode A snapshot, Mode B deep-dive)
                 are answering about their own behaviours, not their org's
                 portfolio, so the section is suppressed and the "your
                 consultant" copy doesn't leak into the self-served flow. */}
            {ctx.assessment.engagement_stage !== "individual" && (
              <UseCasesSection
                token={params.token}
                language={language}
                useCases={(useCases ?? []) as any}
              />
            )}

            {/* Supporting Materials (optional) - org-side only. Personal /
                 individual-stage respondents are submitting a self-assessment,
                 not org-level evidence, so the regulatory-docs upload affordance
                 is suppressed. */}
            {ctx.assessment.engagement_stage !== "individual" && !ctx.respondent.individual_only && (
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
            )}

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
        </QuestionsForm>
      </div>
    </div>
  );
}
