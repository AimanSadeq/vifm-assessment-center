"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check, ChevronLeft, ChevronRight, ClipboardCheck, Download } from "lucide-react";
import type { BehavioralCompetency } from "@/lib/scoring/behavioral-items";
import { saveBehavioralAnswersAction, submitBehavioralAction } from "../actions";

type Props = {
  candidateId: string;
  engagementId: string;
  sessionId: string;
  initialStatus: "not_started" | "in_progress" | "submitted";
  competencies: BehavioralCompetency[];
  saved: Record<string, number>;
};

const LIKERT = [1, 2, 3, 4, 5];

export function BehavioralRunner({
  candidateId,
  engagementId,
  sessionId,
  initialStatus,
  competencies,
  saved,
}: Props) {
  const { i18n } = useTranslation();
  const ar = (i18n.language || "en").startsWith("ar");
  const [answers, setAnswers] = useState<Record<string, number>>(saved);
  const [submitted, setSubmitted] = useState(initialStatus === "submitted");
  const [saving, startSave] = useTransition();
  const [submitting, startSubmit] = useTransition();

  // Group competencies into cluster steps (one cluster per page).
  const steps = useMemo(() => {
    const byCluster = new Map<number, BehavioralCompetency[]>();
    for (const c of competencies) {
      if (!byCluster.has(c.clusterOrder)) byCluster.set(c.clusterOrder, []);
      byCluster.get(c.clusterOrder)!.push(c);
    }
    return Array.from(byCluster.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([order, comps]) => ({ order, comps }));
  }, [competencies]);
  const [step, setStep] = useState(0);

  const totalItems = useMemo(
    () => competencies.reduce((n, c) => n + c.items.length, 0),
    [competencies],
  );
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount >= totalItems;

  // Self-profile (computed client-side from answers, reverse mapped) shown on
  // the submitted screen so the candidate sees their own result.
  const selfProfile = useMemo(() => {
    const byCluster = new Map<number, { name: string; rows: { name: string; score: number }[] }>();
    const all: number[] = [];
    for (const comp of competencies) {
      const vals: number[] = [];
      for (const it of comp.items) {
        const v = answers[it.itemKey];
        if (v == null) continue;
        vals.push(it.reverse ? 6 - v : v);
      }
      if (vals.length === 0) continue;
      const score = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
      all.push(score);
      const cName = ar ? comp.clusterNameAr : comp.clusterNameEn;
      if (!byCluster.has(comp.clusterOrder)) byCluster.set(comp.clusterOrder, { name: cName, rows: [] });
      byCluster.get(comp.clusterOrder)!.rows.push({ name: ar ? comp.nameAr : comp.nameEn, score });
    }
    const clusters = [...byCluster.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => ({
      ...c,
      avg: c.rows.reduce((a, r) => a + r.score, 0) / c.rows.length,
    }));
    const overall = all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 100) / 100 : 0;
    return { clusters, overall };
  }, [answers, competencies, ar]);
  const bandColor = (v: number) => (v >= 4 ? "text-emerald-700" : v >= 3 ? "text-sky-700" : "text-amber-700");

  const tx = (en: string, arabic: string) => (ar ? arabic : en);

  function answer(itemKey: string, acCompetencyId: string, reverse: boolean, value: number) {
    setAnswers((prev) => ({ ...prev, [itemKey]: value }));
    startSave(async () => {
      await saveBehavioralAnswersAction(sessionId, [
        { itemKey, competencyId: acCompetencyId, rawScore: value, isReverse: reverse },
      ]);
    });
  }

  function submit() {
    startSubmit(async () => {
      const res = await submitBehavioralAction(engagementId, candidateId);
      if (res.ok) setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4" dir={ar ? "rtl" : "ltr"}>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <ClipboardCheck className="h-6 w-6 text-emerald-700" />
            </div>
            <h1 className="text-xl font-bold">{tx("Assessment submitted", "تم إرسال التقييم")}</h1>
            <p className="text-sm text-muted-foreground">
              {tx("Thank you. Here is your self-profile.", "شكرًا لك. إليك ملفك الذاتي.")}
            </p>
            <a
              href={`/api/ac/persona/${sessionId}/report`}
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:bg-[#121140]"
            >
              <Download className="h-4 w-4" /> {tx("Download PDF", "تنزيل التقرير (PDF)")}
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>{tx("Your self-profile", "ملفك الذاتي")}</span>
              <span className={`text-base font-bold ${bandColor(selfProfile.overall)}`}>{selfProfile.overall.toFixed(2)} / 5</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selfProfile.clusters.map((cl) => (
              <div key={cl.name}>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#010131]">{cl.name}</p>
                  <span className={`text-xs font-semibold ${bandColor(cl.avg)}`}>{cl.avg.toFixed(1)}</span>
                </div>
                <div className="space-y-1.5">
                  {cl.rows.map((r) => (
                    <div key={r.name}>
                      <div className="flex items-center justify-between text-xs">
                        <span>{r.name}</span>
                        <span className="tabular-nums text-muted-foreground">{r.score.toFixed(1)}</span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full rounded-full bg-muted">
                        <div className="h-1.5 rounded-full bg-[#5391D5]" style={{ width: `${(r.score / 5) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const current = steps[step];
  const likertLabel = (v: number) =>
    ar
      ? ["لا أوافق بشدة", "لا أوافق", "محايد", "أوافق", "أوافق بشدة"][v - 1]
      : ["Strongly disagree", "Disagree", "Neither", "Agree", "Strongly agree"][v - 1];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4" dir={ar ? "rtl" : "ltr"}>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {tx("Persona · Behavioural Competency Self-Assessment", "بيرسونا · التقييم الذاتي للجدارات السلوكية")}
        </p>
        <h1 className="text-xl font-bold">
          {tx("Rate how well each statement describes you", "قيّم مدى انطباق كل عبارة عليك")}
        </h1>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-[#5391D5]"
              style={{ width: `${Math.round((answeredCount / totalItems) * 100)}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {answeredCount}/{totalItems}
          </span>
        </div>
      </div>

      <p className="text-sm font-semibold text-[#010131]">
        {tx("Section", "القسم")} {current.order} / {steps.length}
        {" · "}
        {ar ? current.comps[0]?.clusterNameAr : current.comps[0]?.clusterNameEn}
      </p>

      {current.comps.map((comp) => (
        <Card key={comp.acCompetencyId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{ar ? comp.nameAr : comp.nameEn}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {comp.items.map((it) => (
              <div key={it.itemKey} className="space-y-1.5">
                <p className="text-sm">{ar ? it.textAr : it.textEn}</p>
                <div className="flex flex-wrap gap-1.5">
                  {LIKERT.map((v) => {
                    const selected = answers[it.itemKey] === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => answer(it.itemKey, comp.acCompetencyId, it.reverse, v)}
                        title={likertLabel(v)}
                        className={`min-w-[2.25rem] rounded-md border px-2.5 py-1.5 text-sm transition ${
                          selected
                            ? "border-[#5391D5] bg-[#5391D5] text-white"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-between gap-3 pt-1">
        <Button
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <ChevronLeft className="h-4 w-4" /> {tx("Previous", "السابق")}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {saving ? tx("Saving…", "جارٍ الحفظ…") : tx("Answers save automatically", "تُحفظ الإجابات تلقائيًا")}
        </span>
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
            {tx("Next", "التالي")} <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={!allAnswered || submitting}>
            {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
            {tx("Submit", "إرسال")}
          </Button>
        )}
      </div>
      {!allAnswered && step === steps.length - 1 && (
        <p className="text-end text-[11px] text-amber-600">
          {tx(
            `Answer all ${totalItems} statements to submit (${totalItems - answeredCount} left).`,
            `أجب عن جميع العبارات (${totalItems}) للإرسال (تبقّى ${totalItems - answeredCount}).`,
          )}
        </p>
      )}
    </div>
  );
}
