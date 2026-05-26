import { notFound } from "next/navigation";
import { Aperture, CheckCircle2 } from "lucide-react";
import { loadRaterByToken } from "@/lib/reflect/rater-access";
import { touchReflectRater } from "@/lib/reflect/rater-actions";
import { RaterForm } from "./_components/rater-form";

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
            VIFM Reflect 360 · Leadership feedback
          </div>
        </div>
      </div>
    );
  }

  return <RaterForm ctx={ctx} />;
}
