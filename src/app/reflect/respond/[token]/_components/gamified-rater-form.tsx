"use client";

// Gamified rater experience for Reflect 360 - opt-in via engagement.gamified_mode.
// Same items, same server actions, same reflect_responses rows as RaterForm - the
// ONLY difference is the rater UX: one focused card at a time, progress + momentum,
// mobile-first. Scoring/reporting/anonymity downstream are byte-for-byte identical.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Aperture,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  WifiOff,
  Globe,
  Sparkles,
  Trophy,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OpenQuestionsBlock } from "./open-questions-block";
import {
  saveReflectResponse,
  markReflectRaterComplete,
  saveReflectOpenResponse,
  saveReflectCriticalPicks,
  saveReflectRaterTenure,
} from "@/lib/reflect/rater-actions";
import type {
  RaterContext,
  ReflectRaterTenure,
  BehaviorRow,
  CompetencyRow,
} from "@/lib/reflect/rater-access";

type LocalAnswer = { score: number | null; is_na: boolean; comment_text: string };

const SCALE_LABELS = {
  en: { 1: "Almost never", 2: "Rarely", 3: "Sometimes", 4: "Often", 5: "Almost always", na: "Not observable" },
  ar: { 1: "نادرًا جدًا", 2: "نادرًا", 3: "أحيانًا", 4: "غالبًا", 5: "دائمًا تقريبًا", na: "غير قابل للملاحظة" },
} as const;

const ROLE_FRAMING = {
  en: {
    self: { title: "Self assessment", lead: "Rate how often you show each behaviour." },
    manager: { title: "Manager perspective", lead: "Rate how often your direct report shows each behaviour." },
    peer: { title: "Peer perspective", lead: "Rate how often your colleague shows each behaviour." },
    direct_report: { title: "Direct-report perspective", lead: "Rate how often your line manager shows each behaviour." },
    skip_level: { title: "Skip-level perspective", lead: "Rate how often this leader shows each behaviour." },
    other: { title: "Cross-functional perspective", lead: "Rate how often your collaborator shows each behaviour." },
  },
  ar: {
    self: { title: "التقييم الذاتي", lead: "قيّم مدى تكرار قيامك بكل سلوك." },
    manager: { title: "منظور المدير", lead: "قيّم مدى تكرار قيام تقريرك المباشر بكل سلوك." },
    peer: { title: "منظور الزميل", lead: "قيّم مدى تكرار قيام زميلك بكل سلوك." },
    direct_report: { title: "منظور التقرير المباشر", lead: "قيّم مدى تكرار قيام مديرك المباشر بكل سلوك." },
    skip_level: { title: "منظور القائد الأعلى", lead: "قيّم مدى تكرار قيام هذا القائد بكل سلوك." },
    other: { title: "المنظور المتعدد الوظائف", lead: "قيّم مدى تكرار قيام شريكك بكل سلوك." },
  },
} as const;

const G = {
  en: {
    estimate: (n: number) => `${n} quick cards · about ${Math.max(2, Math.round(n * 0.25))} min`,
    start: "Start",
    of: "of",
    na: "Can't say",
    back: "Back",
    next: "Next",
    addComment: "Add a note (optional)",
    notePlaceholder: "Anything you'd add in your own words…",
    saving: "Saving…",
    saved: "Saved",
    failed: "Save failed - will retry",
    offline: "You're offline - answers save when you reconnect",
    milestoneQuarter: "Great start! 🎯",
    milestoneHalf: "Halfway there 🔥",
    milestoneThree: "Almost done 💪",
    finalTitle: "Last step - in your own words",
    finalLead: "The most valuable part of any 360. Skip any you'd rather not answer.",
    startQ: "What should they START doing?",
    stopQ: "What should they STOP doing?",
    continueQ: "What should they CONTINUE doing?",
    startQSelf: "What do you want to START doing?",
    stopQSelf: "What do you want to STOP doing?",
    continueQSelf: "What do you want to CONTINUE doing?",
    openPlaceholder: "Optional - write as much or as little as you like.",
    criticalTitle: "Which competencies matter most for this role?",
    tenureTitle: "How long have you worked with this person?",
    tenureLead: "Optional - adds context to your feedback.",
    tenure: { less_than_6mo: "< 6 months", six_mo_to_2yr: "6 mo - 2 yr", two_to_5yr: "2 - 5 yr", over_5yr: "5 yr +" },
    submit: "Submit my feedback",
    submitting: "Submitting…",
    needAll: "Rate every card to submit",
    couldNotSave: (n: number) =>
      `${n} answer${n === 1 ? "" : "s"} could not be saved - nothing has been submitted yet. Check your connection and tap Submit again.`,
    doneBadge: "All cards done",
    remaining: (n: number) => `${n} card${n === 1 ? "" : "s"} still need a rating`,
    goToRemaining: "Rate the remaining cards",
  },
  ar: {
    estimate: (n: number) => `${n} بطاقة سريعة · نحو ${Math.max(2, Math.round(n * 0.25))} دقيقة`,
    start: "ابدأ",
    of: "من",
    na: "لا أستطيع التقييم",
    back: "رجوع",
    next: "التالي",
    addComment: "أضف ملاحظة (اختياري)",
    notePlaceholder: "أي شيء تودّ إضافته بكلماتك…",
    saving: "جارٍ الحفظ…",
    saved: "تم الحفظ",
    failed: "تعذّر الحفظ - ستتم إعادة المحاولة",
    offline: "أنت غير متصل - ستُحفظ الإجابات عند عودة الاتصال",
    milestoneQuarter: "بداية رائعة! 🎯",
    milestoneHalf: "في منتصف الطريق 🔥",
    milestoneThree: "أوشكت على الانتهاء 💪",
    finalTitle: "الخطوة الأخيرة - بكلماتك الخاصة",
    finalLead: "أهم جزء في أي تقييم 360. يمكنك تجاوز أي سؤال.",
    startQ: "ما الذي ينبغي أن يبدأ بفعله؟",
    stopQ: "ما الذي ينبغي أن يتوقّف عن فعله؟",
    continueQ: "ما الذي ينبغي أن يستمر في فعله؟",
    startQSelf: "ما الذي تريد أن تبدأ بفعله؟",
    stopQSelf: "ما الذي تريد أن تتوقّف عن فعله؟",
    continueQSelf: "ما الذي تريد أن تستمر في فعله؟",
    openPlaceholder: "اختياري - اكتب بقدر ما تشاء.",
    criticalTitle: "ما الكفايات الأكثر أهمية لهذا الدور؟",
    tenureTitle: "منذ متى تعمل مع هذا الشخص؟",
    tenureLead: "اختياري - يضيف سياقًا لرأيك.",
    tenure: { less_than_6mo: "< 6 أشهر", six_mo_to_2yr: "6 أشهر – سنتان", two_to_5yr: "سنتان – 5 سنوات", over_5yr: "5 سنوات +" },
    submit: "إرسال رأيي",
    submitting: "جارٍ الإرسال…",
    needAll: "قيّم كل البطاقات قبل الإرسال",
    couldNotSave: (n: number) =>
      `تعذّر حفظ ${n} إجابة - لم يتم إرسال أي شيء بعد. تحقّق من اتصالك واضغط إرسال مرة أخرى.`,
    doneBadge: "اكتملت كل البطاقات",
    remaining: (n: number) => `${n} بطاقة بحاجة إلى تقييم`,
    goToRemaining: "قيّم البطاقات المتبقّية",
  },
} as const;

const TENURE_ORDER: ReflectRaterTenure[] = ["less_than_6mo", "six_mo_to_2yr", "two_to_5yr", "over_5yr"];

export function GamifiedRaterForm({ ctx, preview = false }: { ctx: RaterContext; preview?: boolean }) {
  const router = useRouter();
  const [language, setLanguage] = useState<"en" | "ar">(ctx.rater.language_preference);
  const rtl = language === "ar";
  const t = G[language];
  const scale = SCALE_LABELS[language];
  const framing = ROLE_FRAMING[language][ctx.rater.rater_role];
  const isSelf = ctx.rater.rater_role === "self";

  // Flatten every behaviour into one ordered list of cards.
  const items = useMemo(() => {
    const arr: { behavior: BehaviorRow; comp: CompetencyRow }[] = [];
    for (const c of ctx.competencies) for (const b of c.behaviors) arr.push({ behavior: b, comp: c });
    return arr;
  }, [ctx]);
  const total = items.length;

  const initial: Record<string, LocalAnswer> = useMemo(() => {
    const m: Record<string, LocalAnswer> = {};
    for (const it of items) {
      const r = ctx.responses.get(it.behavior.id);
      m[it.behavior.id] = { score: r?.score ?? null, is_na: r?.is_na ?? false, comment_text: r?.comment_text ?? "" };
    }
    return m;
  }, [items, ctx]);

  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>(initial);
  const [openText, setOpenText] = useState({
    start: ctx.openResponses.start,
    stop: ctx.openResponses.stop,
    continue_: ctx.openResponses.continue_,
  });
  const [criticalPicks, setCriticalPicks] = useState<Set<string>>(() => new Set(ctx.criticalCompetencyIds));
  const [tenure, setTenureState] = useState<ReflectRaterTenure | null>(ctx.tenure);
  const showCritical = isSelf || ctx.rater.rater_role === "manager";
  const showTenure = !isSelf;

  // Resume at the first unanswered card; finished raters drop into the final step.
  const firstUnanswered = items.findIndex((it) => {
    const a = initial[it.behavior.id];
    return !(a && (a.score !== null || a.is_na));
  });
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(firstUnanswered === -1 ? total : Math.max(0, firstUnanswered));
  const [showNote, setShowNote] = useState(false);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "failed">("idle");
  const [previewDone, setPreviewDone] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [submitting, startSubmitting] = useTransition();

  const inflightRef = useRef<Map<number, Promise<void>>>(new Map());
  const saveIdRef = useRef(0);
  const commentTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const openTimerRef = useRef<Map<"start" | "stop" | "continue", ReturnType<typeof setTimeout>>>(new Map());
  // Track every save that FAILED so submit can retry them and REFUSE to mark the
  // rater complete while any remain unsaved - matching the standard RaterForm's
  // hardened gate (rater-form.tsx). Without this, a transient save failure on a
  // gamified engagement silently drops the answer from the consultant's report:
  // the taker cannot re-enter it once status flips to completed. Keys mirror the
  // standard form: `beh:<id>`, `open:<kind>`, `open5:<kind>`, `tenure`, `critical`.
  const failedRef = useRef<Set<string>>(new Set());
  const openBlockRetryRef = useRef<(() => Promise<void>) | null>(null);
  // Mirror of `answers` so handlers can read the latest value WITHOUT putting the
  // save side-effect inside the setAnswers updater (which delayed the visual
  // highlight - the selection now paints immediately and the save runs after).
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    const sync = () => setIsOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const track = (p: Promise<void>) => {
    const id = ++saveIdRef.current;
    const wrapped = p.finally(() => {
      inflightRef.current.delete(id);
      if (inflightRef.current.size === 0) setSaveState((c) => (c === "failed" ? c : "idle"));
    });
    inflightRef.current.set(id, wrapped);
    return wrapped;
  };

  const persistOne = (behaviorId: string, next: LocalAnswer) => {
    if (preview) return Promise.resolve();
    setSaveState("saving");
    return track(
      (async () => {
        try {
          const res = await saveReflectResponse({
            token: ctx.rater.access_token,
            behavior_id: behaviorId,
            score: next.is_na ? null : next.score,
            is_na: next.is_na,
            comment_text: next.comment_text.trim() || null,
          });
          if (!res.ok) {
            failedRef.current.add(`beh:${behaviorId}`);
            setSaveState("failed");
            return;
          }
          failedRef.current.delete(`beh:${behaviorId}`);
        } catch {
          failedRef.current.add(`beh:${behaviorId}`);
          setSaveState("failed");
        }
      })()
    );
  };

  const persistOpen = (kind: "start" | "stop" | "continue", text: string) => {
    if (preview) return Promise.resolve();
    setSaveState("saving");
    return track(
      (async () => {
        try {
          const res = await saveReflectOpenResponse({ token: ctx.rater.access_token, kind, text });
          if (!res.ok) {
            failedRef.current.add(`open:${kind}`);
            setSaveState("failed");
            return;
          }
          failedRef.current.delete(`open:${kind}`);
        } catch {
          failedRef.current.add(`open:${kind}`);
          setSaveState("failed");
        }
      })()
    );
  };

  const completed = useMemo(
    () => Object.values(answers).filter((a) => a.score !== null || a.is_na).length,
    [answers]
  );
  const allRated = completed === total;

  const advance = () => {
    setShowNote(false);
    setIndex((i) => Math.min(i + 1, total));
  };

  const answer = (behaviorId: string, patch: Partial<LocalAnswer>, autoAdvance: boolean) => {
    const cur = answersRef.current[behaviorId] ?? { score: null, is_na: false, comment_text: "" };
    const next = { ...cur, ...patch };
    // Paint the selection immediately (pure state update), THEN fire the save -
    // never inside the updater, so the highlight doesn't wait on the server.
    answersRef.current = { ...answersRef.current, [behaviorId]: next };
    setAnswers((prev) => ({ ...prev, [behaviorId]: next }));
    persistOne(behaviorId, next);
    // Auto-advance, but guard against a DOUBLE advance: if the rater also taps
    // "Next" (or rates quickly - this is mobile-first), `index` may already have
    // moved past this card by the time the 220ms timer fires. Advancing again
    // would SKIP the next card, leaving it unrated while the rater still reaches
    // the end - the "All cards done but can't submit" bug. Only advance if we're
    // still on the card that was just answered.
    if (autoAdvance) {
      const from = index;
      setTimeout(() => {
        setShowNote(false);
        setIndex((i) => (i === from ? Math.min(i + 1, total) : i));
      }, 220);
    }
  };

  const setComment = (behaviorId: string, value: string) => {
    setAnswers((prev) => {
      const cur = prev[behaviorId] ?? { score: null, is_na: false, comment_text: "" };
      const next = { ...cur, comment_text: value };
      const existing = commentTimerRef.current.get(behaviorId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        persistOne(behaviorId, next);
        commentTimerRef.current.delete(behaviorId);
      }, 700);
      commentTimerRef.current.set(behaviorId, timer);
      return { ...prev, [behaviorId]: next };
    });
  };

  const setOpen = (kind: "start" | "stop" | "continue", value: string) => {
    const key = kind === "continue" ? "continue_" : kind;
    setOpenText((prev) => ({ ...prev, [key]: value }));
    const existing = openTimerRef.current.get(kind);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      persistOpen(kind, value);
      openTimerRef.current.delete(kind);
    }, 700);
    openTimerRef.current.set(kind, timer);
  };

  const persistCritical = (ids: string[]) => {
    if (preview) return Promise.resolve();
    setSaveState("saving");
    return track(
      (async () => {
        try {
          const res = await saveReflectCriticalPicks({ token: ctx.rater.access_token, competency_ids: ids });
          if (!res.ok) {
            failedRef.current.add("critical");
            setSaveState("failed");
            return;
          }
          failedRef.current.delete("critical");
        } catch {
          failedRef.current.add("critical");
          setSaveState("failed");
        }
      })()
    );
  };

  const toggleCritical = (competencyId: string) => {
    setCriticalPicks((prev) => {
      const next = new Set(prev);
      if (next.has(competencyId)) next.delete(competencyId);
      else next.add(competencyId);
      persistCritical(Array.from(next));
      return next;
    });
  };

  const persistTenure = (next: ReflectRaterTenure) => {
    if (preview) return Promise.resolve();
    setSaveState("saving");
    return track(
      (async () => {
        try {
          const res = await saveReflectRaterTenure({ token: ctx.rater.access_token, tenure: next });
          if (!res.ok) {
            failedRef.current.add("tenure");
            setSaveState("failed");
            return;
          }
          failedRef.current.delete("tenure");
        } catch {
          failedRef.current.add("tenure");
          setSaveState("failed");
        }
      })()
    );
  };

  const setTenure = (next: ReflectRaterTenure) => {
    setTenureState(next);
    persistTenure(next);
  };

  const submit = () => {
    if (preview) {
      setPreviewDone(true);
      return;
    }
    startSubmitting(async () => {
      // 1. Flush debounced comment + Start/Stop/Continue timers.
      for (const [bid, timer] of Array.from(commentTimerRef.current.entries())) {
        clearTimeout(timer);
        commentTimerRef.current.delete(bid);
        const a = answersRef.current[bid];
        if (a) persistOne(bid, a);
      }
      for (const [kind, timer] of Array.from(openTimerRef.current.entries())) {
        clearTimeout(timer);
        openTimerRef.current.delete(kind);
        const key = kind === "continue" ? "continue_" : kind;
        persistOpen(kind, openText[key]);
      }

      // 2. Await every in-flight save (the freshly fired ones included).
      const inflight = Array.from(inflightRef.current.values());
      if (inflight.length > 0) await Promise.all(inflight);

      // 2b. Re-try saves that FAILED earlier - awaiting in-flight alone would
      //     silently drop them behind the completion screen (they are in no queue).
      const failedKeys = Array.from(failedRef.current);
      if (failedKeys.length > 0) {
        let retryOpenBlock = false;
        for (const key of failedKeys) {
          if (key.startsWith("beh:")) {
            const bid = key.slice(4);
            const a = answersRef.current[bid];
            if (a) persistOne(bid, a);
          } else if (key.startsWith("open5:")) {
            retryOpenBlock = true; // the 5-questions block owns its text; retry via its handle
          } else if (key.startsWith("open:")) {
            const kind = key.slice(5) as "start" | "stop" | "continue";
            const sk = kind === "continue" ? "continue_" : kind;
            persistOpen(kind, openText[sk]);
          } else if (key === "tenure") {
            if (tenure) persistTenure(tenure);
          } else if (key === "critical") {
            persistCritical(Array.from(criticalPicks));
          }
        }
        if (retryOpenBlock && openBlockRetryRef.current) {
          await openBlockRetryRef.current();
        }
        const retryInflight = Array.from(inflightRef.current.values());
        if (retryInflight.length > 0) await Promise.all(retryInflight);
      }

      // 3. REFUSE completion while anything is still unsaved - completing anyway
      //    would silently drop those answers behind a success screen.
      if (failedRef.current.size > 0) {
        setUnsavedCount(failedRef.current.size);
        setSaveState("failed");
        return;
      }
      setUnsavedCount(0);

      // 4. Now safe to mark complete.
      const res = await markReflectRaterComplete(ctx.rater.access_token);
      if (!res.ok) {
        setSaveState("failed");
        return;
      }
      router.refresh();
    });
  };

  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const milestone =
    completed > 0 && completed === Math.round(total * 0.25)
      ? t.milestoneQuarter
      : completed === Math.round(total * 0.5)
        ? t.milestoneHalf
        : completed === Math.round(total * 0.75)
          ? t.milestoneThree
          : null;

  const compName = (c: CompetencyRow) => (rtl ? c.name_ar ?? c.name_en : c.name_en);
  const behText = (b: BehaviorRow) => (rtl ? b.text_ar ?? b.text_en : b.text_en);

  const SaveDot = () => (
    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
      {saveState === "saving" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" /> {t.saving}
        </>
      ) : saveState === "failed" ? (
        <span className="text-amber-600">{t.failed}</span>
      ) : (
        <>
          <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {t.saved}
        </>
      )}
    </span>
  );

  if (previewDone) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center" dir={rtl ? "rtl" : "ltr"}>
        <div className="max-w-md">
          <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Trophy className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold text-primary mb-2">{rtl ? "انتهت المعاينة" : "Preview complete"}</h1>
          <p className="text-sm text-muted-foreground">
            {rtl
              ? "هكذا يختبر المُقيّمون التقييم 360 التفاعلي. لم يُحفظ أي شيء."
              : "That's the gamified 360 as your raters experience it. Nothing was saved."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background flex flex-col" dir={rtl ? "rtl" : "ltr"}>
      {!isOnline && (
        <div className="bg-amber-100 text-amber-900 px-4 py-2 text-xs flex items-center gap-2 justify-center border-b border-amber-200">
          <WifiOff className="h-3.5 w-3.5" /> {t.offline}
        </div>
      )}
      {preview && (
        <div className="bg-primary/10 text-primary px-4 py-2 text-xs text-center border-b border-primary/20 font-medium">
          {rtl ? "معاينة - لا يُحفظ أي شيء تنقر عليه هنا" : "Preview - nothing you tap here is saved"}
        </div>
      )}

      {/* Top bar: brand + progress + language */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b">
        <div className="max-w-xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Aperture className="h-3.5 w-3.5" /> Reflect 360®
            </span>
            <button
              onClick={() => setLanguage((l) => (l === "en" ? "ar" : "en"))}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Globe className="h-3.5 w-3.5" /> {language === "en" ? "العربية" : "English"}
            </button>
          </div>
          {started && (
            <div className="mt-2">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{index < total ? `${index + 1} ${t.of} ${total}` : `${total} / ${total}`}</span>
                {milestone ? <span className="font-medium text-primary">{milestone}</span> : <SaveDot />}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 max-w-xl w-full mx-auto px-4 py-6">
        {/* ── Intro ── */}
        {!started && (
          <div className="text-center pt-8">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-5">
              <Rocket className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-semibold text-primary">{framing.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{framing.lead}</p>
            {!isSelf && (
              <p className="mx-auto mt-3 max-w-md rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary/80">
                {rtl
                  ? "تُدمج تقييماتك الفردية مع تقييمات المُقيّمين الآخرين وتُعرض كمتوسط للمجموعة فقط - لا يطّلع أحد على درجاتك الفردية."
                  : "Your individual ratings are combined with those of other raters and shown only as a group average - no one sees your individual scores."}
              </p>
            )}
            <p className="mt-3 text-xs font-medium text-primary/80">{t.estimate(total)}</p>

            {showTenure && (
              <div className="mt-6 text-start">
                <p className="text-sm font-medium">{t.tenureTitle}</p>
                <p className="text-xs text-muted-foreground mb-2">{t.tenureLead}</p>
                <div className="grid grid-cols-2 gap-2">
                  {TENURE_ORDER.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setTenure(opt)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm transition-colors",
                        tenure === opt ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
                      )}
                    >
                      {t.tenure[opt]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setStarted(true)}
              className="mt-8 w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95"
            >
              {t.start} <ChevronRight className={cn("h-4 w-4", rtl && "rotate-180")} />
            </button>
          </div>
        )}

        {/* ── Rating card ── */}
        {started && index < total && (() => {
          const it = items[index];
          const a = answers[it.behavior.id] ?? { score: null, is_na: false, comment_text: "" };
          return (
            <div className="pt-2">
              <p className="text-[11px] uppercase tracking-wide text-primary/70 font-semibold">{compName(it.comp)}</p>
              <div className="mt-3 rounded-2xl border bg-card p-5 shadow-sm">
                <p className="text-lg leading-relaxed font-medium">{behText(it.behavior)}</p>

                <div className="mt-5 grid gap-2" role="radiogroup" aria-label={behText(it.behavior)}>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <button
                      key={n}
                      role="radio"
                      aria-checked={a.score === n}
                      aria-label={scale[n as 1 | 2 | 3 | 4 | 5]}
                      onClick={() => answer(it.behavior.id, { score: n, is_na: false }, true)}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all",
                        a.score === n ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted hover:border-primary/40"
                      )}
                    >
                      <span className="font-medium">{scale[n as 1 | 2 | 3 | 4 | 5]}</span>
                      <span className={cn("text-xs tabular-nums", a.score === n ? "opacity-90" : "text-muted-foreground")}>{n}</span>
                    </button>
                  ))}
                  <button
                    role="radio"
                    aria-checked={a.is_na}
                    aria-label={t.na}
                    onClick={() => answer(it.behavior.id, { is_na: true, score: null }, true)}
                    className={cn(
                      "rounded-xl border px-4 py-2.5 text-sm transition-colors",
                      a.is_na ? "bg-muted-foreground/15 border-muted-foreground/30 text-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {t.na}
                  </button>
                </div>

                {showNote ? (
                  <textarea
                    autoFocus
                    value={a.comment_text}
                    onChange={(e) => setComment(it.behavior.id, e.target.value)}
                    placeholder={t.notePlaceholder}
                    rows={2}
                    maxLength={2000}
                    className="mt-3 w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                ) : (
                  <button onClick={() => setShowNote(true)} className="mt-3 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> {a.comment_text ? a.comment_text.slice(0, 40) + (a.comment_text.length > 40 ? "…" : "") : t.addComment}
                  </button>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => {
                    setShowNote(false);
                    setIndex((i) => Math.max(0, i - 1));
                  }}
                  disabled={index === 0}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground disabled:opacity-40 hover:text-foreground"
                >
                  <ChevronLeft className={cn("h-4 w-4", rtl && "rotate-180")} /> {t.back}
                </button>
                <button
                  onClick={advance}
                  disabled={a.score === null && !a.is_na}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary disabled:opacity-40"
                >
                  {t.next} <ChevronRight className={cn("h-4 w-4", rtl && "rotate-180")} />
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Final step ── */}
        {started && index >= total && (
          <div className="pt-2 space-y-6">
            <div className="text-center">
              {allRated ? (
                <>
                  <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-2">
                    <Trophy className="h-6 w-6 text-emerald-600" />
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t.doneBadge}
                  </span>
                </>
              ) : (
                /* Recovery: a card was left unrated (e.g. skipped on a fast tap).
                   Surface it and jump straight to the first unrated card so the
                   rater is never stuck at a "done"-looking screen that won't submit. */
                <>
                  <div className="h-12 w-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-2">
                    <Sparkles className="h-6 w-6 text-amber-600" />
                  </div>
                  <p className="text-sm font-medium text-amber-700">{t.remaining(total - completed)}</p>
                  <button
                    onClick={() => {
                      const firstUnrated = items.findIndex((it) => {
                        const a = answers[it.behavior.id];
                        return !(a && (a.score !== null || a.is_na));
                      });
                      if (firstUnrated !== -1) {
                        setShowNote(false);
                        setIndex(firstUnrated);
                      }
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  >
                    {t.goToRemaining} <ChevronRight className={cn("h-3.5 w-3.5", rtl && "rotate-180")} />
                  </button>
                </>
              )}
            </div>

            {showCritical && (
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-sm font-medium mb-2">{t.criticalTitle}</p>
                <div className="flex flex-wrap gap-2">
                  {ctx.competencies.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => toggleCritical(c.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition-colors",
                        criticalPicks.has(c.id) ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
                      )}
                    >
                      {compName(c)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border bg-card p-4 space-y-4">
              <div>
                <p className="text-sm font-medium">{t.finalTitle}</p>
                <p className="text-xs text-muted-foreground">{t.finalLead}</p>
              </div>
              {([
                ["start", isSelf ? t.startQSelf : t.startQ],
                ["stop", isSelf ? t.stopQSelf : t.stopQ],
                ["continue", isSelf ? t.continueQSelf : t.continueQ],
              ] as const).map(([kind, label]) => {
                const key = kind === "continue" ? "continue_" : kind;
                return (
                  <div key={kind}>
                    <label className="text-xs font-medium text-foreground">{label}</label>
                    <textarea
                      value={openText[key]}
                      onChange={(e) => setOpen(kind, e.target.value)}
                      placeholder={t.openPlaceholder}
                      rows={2}
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border bg-card p-4">
              <OpenQuestionsBlock
                token={ctx.rater.access_token}
                isSelf={isSelf}
                ar={rtl}
                initial={ctx.openQuestions}
                registerInflight={(p) => track(Promise.resolve(p).then(() => {}, () => {}))}
                onSaveResult={(kind, ok) => {
                  if (ok) failedRef.current.delete(`open5:${kind}`);
                  else failedRef.current.add(`open5:${kind}`);
                }}
                registerRetry={(fn) => {
                  openBlockRetryRef.current = fn;
                }}
              />
            </div>

            <button
              onClick={submit}
              disabled={!allRated || submitting}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t.submitting}
                </>
              ) : (
                t.submit
              )}
            </button>
            {!allRated && <p className="text-center text-xs text-amber-600">{t.needAll}</p>}
            {unsavedCount > 0 && (
              <p className="text-center text-xs font-medium text-rose-600">{t.couldNotSave(unsavedCount)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
