"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Languages } from "lucide-react";
import { HIPO_ENGAGEMENT_ITEMS, ENGAGEMENT_MIN_ANSWERED } from "@/lib/hipo/engagement-items";
import { submitEngagementAction } from "../actions";

const SCALE_EN = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
const SCALE_AR = ["لا أوافق بشدة", "لا أوافق", "محايد", "أوافق", "أوافق بشدة"];

export function EngageForm({
  token,
  managerName,
  candidateName,
}: {
  token: string;
  managerName: string;
  candidateName: string;
}) {
  const [ar, setAr] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const answered = Object.keys(answers).length;
  const t = (en: string, arText: string) => (ar ? arText : en);

  if (done) {
    return (
      <div className="text-center py-6" dir={ar ? "rtl" : "ltr"}>
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-3 text-lg font-bold text-[#010131]">{t("Thank you", "شكرا لك")}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {t(
            `Your view on ${candidateName} was recorded. It feeds the Engagement reading of their High-Potential Profile.`,
            `تم تسجيل تقييمك حول ${candidateName}. سيغذي هذا قراءة الالتزام في ملف الإمكانات العالية.`,
          )}
        </p>
      </div>
    );
  }

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await submitEngagementAction({ token, answers, contextNote: note });
      if (res.ok) setDone(true);
      else setError(res.error);
    });

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#010131]">
            {t(`About ${candidateName}`, `حول ${candidateName}`)}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t(
              `Dear ${managerName} - please rate the statements below based on what you observe as ${candidateName}'s line manager. It takes about five minutes. Your answers are a management judgement that informs a development conversation - not a test of ${candidateName}, and never a pass/fail signal.`,
              `عزيزي/عزيزتي ${managerName} - يرجى تقييم العبارات أدناه بناء على ما تلاحظه بصفتك المدير المباشر لـ${candidateName}. يستغرق ذلك نحو خمس دقائق. إجاباتك تقدير إداري يدعم حوار التطوير - وليست اختبارا لـ${candidateName} ولا إشارة نجاح أو رسوب.`,
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAr((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Languages className="h-3.5 w-3.5" /> {ar ? "English" : "العربية"}
        </button>
      </div>

      <div className="mt-5 space-y-5">
        {HIPO_ENGAGEMENT_ITEMS.map((item, idx) => (
          <fieldset key={item.key} className="rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-[#010131]">
              {idx + 1}. {ar ? item.ar : item.en}
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-5">
              {[1, 2, 3, 4, 5].map((v) => (
                <label
                  key={v}
                  className={`flex cursor-pointer items-center justify-center rounded-md border px-2 py-2 text-center text-xs transition ${
                    answers[item.key] === v
                      ? "border-[#5391D5] bg-[#eef4fc] font-semibold text-[#010131]"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={item.key}
                    value={v}
                    checked={answers[item.key] === v}
                    onChange={() => setAnswers((a) => ({ ...a, [item.key]: v }))}
                    className="sr-only"
                  />
                  {(ar ? SCALE_AR : SCALE_EN)[v - 1]}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <div>
          <label htmlFor="hipo-note" className="text-sm font-semibold text-[#010131]">
            {t("Anything that gives context to your answers? (optional)", "هل من سياق إضافي لإجاباتك؟ (اختياري)")}
          </label>
          <textarea
            id="hipo-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5391D5]/40"
            placeholder={t("e.g. recent role change, team context…", "مثلا: تغيير حديث في الدور، سياق الفريق…")}
          />
          <p className="mt-1 text-xs text-slate-500">
            {t("Visible to the VIFM consultant only - never included in the client report.", "يظهر لمستشار VIFM فقط - ولا يُدرج أبدا في تقرير العميل.")}
          </p>
        </div>

        {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {t(
              `${answered}/${HIPO_ENGAGEMENT_ITEMS.length} answered · at least ${ENGAGEMENT_MIN_ANSWERED} required`,
              `${answered}/${HIPO_ENGAGEMENT_ITEMS.length} تمت الإجابة · المطلوب ${ENGAGEMENT_MIN_ANSWERED} على الأقل`,
            )}
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={pending || answered < ENGAGEMENT_MIN_ANSWERED}
            className="rounded-md bg-[#010131] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#121140] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? t("Submitting…", "جارٍ الإرسال…") : t("Submit survey", "إرسال الاستبيان")}
          </button>
        </div>
      </div>
    </div>
  );
}
