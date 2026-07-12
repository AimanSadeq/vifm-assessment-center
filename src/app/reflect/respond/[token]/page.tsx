import { notFound } from "next/navigation";
import { Aperture, CheckCircle2 } from "lucide-react";
import { loadRaterByToken } from "@/lib/reflect/rater-access";
import { touchReflectRater } from "@/lib/reflect/rater-actions";
import { RaterForm } from "./_components/rater-form";
import { GamifiedRaterForm } from "./_components/gamified-rater-form";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export default async function ReflectRespondPage({ params }: Params) {
  const { token } = await params;
  const ctx = await loadRaterByToken(token);
  if (!ctx) return notFound();

  // Touch is idempotent - bump first_opened_at + last_active_at.
  await touchReflectRater(token);

  // Once the rater has marked complete, show the thank-you screen and
  // do NOT render the form again.
  if (ctx.rater.status === "completed") {
    const rtl = ctx.rater.language_preference === "ar";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6" dir={rtl ? "rtl" : "ltr"}>
        <div className="max-w-lg text-center">
          <div className="h-14 w-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-semibold text-primary mb-3">
            {rtl ? "تم استلام إجاباتك" : "Your responses are in"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {rtl
              ? `شكرًا لمساهمتك في تقييم ${ctx.participant.full_name}. تظل إجاباتك مجهولة الهوية ضمن نتائج المجموعة، وسيتسلم ${ctx.participant.full_name} تقريرًا موحّدًا بعد إغلاق نافذة التقييم.`
              : `Thank you for your contribution to ${ctx.participant.full_name}'s development. Your responses stay anonymised in the group view; ${ctx.participant.full_name} will receive a consolidated report once the field window closes.`}
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Aperture className="h-3.5 w-3.5" />
            Reflect 360® · Leadership feedback
          </div>
        </div>
      </div>
    );
  }

  // Not writable: either the engagement hasn't launched yet (draft - the window
  // has NOT opened), or it is past collection (field window closed / scoring /
  // complete). Every write would be rejected server-side, so show a read-only
  // state instead of a form that errors on save - with copy matched to WHICH case.
  if (!ctx.writable) {
    const rtl = ctx.rater.language_preference === "ar";
    const notYetOpen = ctx.engagement.status === "draft";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6" dir={rtl ? "rtl" : "ltr"}>
        <div className="max-w-lg text-center">
          <div className="h-14 w-14 rounded-full bg-muted border flex items-center justify-center mx-auto mb-5">
            <Aperture className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-primary mb-3">
            {notYetOpen
              ? rtl
                ? "لم تُفتح نافذة التقييم بعد"
                : "This feedback window hasn't opened yet"
              : rtl
                ? "أُغلقت نافذة التقييم"
                : "This feedback window has closed"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {notYetOpen
              ? rtl
                ? `لم يبدأ جمع التقييمات لـ ${ctx.participant.full_name} بعد. ستصلك رسالة عند فتح النافذة - يُرجى التواصل مع الجهة التي دعتك إذا كان لديك استفسار.`
                : `Feedback collection for ${ctx.participant.full_name} hasn't started yet. You'll be notified when it opens - please contact whoever invited you if you have any questions.`
              : rtl
                ? `لم يعد بإمكاننا قبول تقييمات جديدة لـ ${ctx.participant.full_name}. إذا كنت تعتقد أن هذا خطأ، يُرجى التواصل مع الجهة التي دعتك.`
                : `We can no longer accept new feedback for ${ctx.participant.full_name}. If you think this is a mistake, please contact whoever invited you.`}
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Aperture className="h-3.5 w-3.5" />
            Reflect 360® · Leadership feedback
          </div>
        </div>
      </div>
    );
  }

  return ctx.engagement.gamified_mode ? <GamifiedRaterForm ctx={ctx} /> : <RaterForm ctx={ctx} />;
}
