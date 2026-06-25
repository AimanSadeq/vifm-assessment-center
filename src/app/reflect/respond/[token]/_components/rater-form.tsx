"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Aperture,
  CheckCircle2,
  Loader2,
  WifiOff,
  Globe,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  saveReflectResponse,
  markReflectRaterComplete,
  saveReflectOpenResponse,
  saveReflectCriticalPicks,
  saveReflectRaterTenure,
} from "@/lib/reflect/rater-actions";
import type { RaterContext, ReflectRaterTenure } from "@/lib/reflect/rater-access";
import { OpenQuestionsBlock } from "./open-questions-block";

type LocalAnswer = {
  score: number | null;
  is_na: boolean;
  comment_text: string;
  // Tracks the most recent in-flight save for this behaviour so the
  // Submit-flush gate can await it before calling markComplete.
  inflight?: Promise<unknown>;
};

const SCALE_LABELS = {
  en: {
    1: "Almost never",
    2: "Rarely",
    3: "Sometimes",
    4: "Often",
    5: "Almost always",
    na: "Not observable",
  },
  ar: {
    1: "نادرًا جدًا",
    2: "نادرًا",
    3: "أحيانًا",
    4: "غالبًا",
    5: "دائمًا تقريبًا",
    na: "غير قابل للملاحظة",
  },
} as const;

const ROLE_FRAMING = {
  en: {
    self: { title: "Self assessment", lead: "Rate how often you demonstrate each behaviour." },
    manager: { title: "Manager perspective", lead: "Rate how often your direct report demonstrates each behaviour." },
    peer: { title: "Peer perspective", lead: "Rate how often your colleague demonstrates each behaviour." },
    direct_report: { title: "Direct-report perspective", lead: "Rate how often your line manager demonstrates each behaviour." },
    skip_level: { title: "Skip-level perspective", lead: "Rate how often this leader demonstrates each behaviour." },
    other: { title: "Cross-functional perspective", lead: "Rate how often your collaborator demonstrates each behaviour." },
  },
  ar: {
    self: { title: "التقييم الذاتي", lead: "قيّم مدى تكرار قيامك بكل من هذه السلوكيات." },
    manager: { title: "منظور المدير", lead: "قيّم مدى تكرار قيام تقريرك المباشر بكل من هذه السلوكيات." },
    peer: { title: "منظور الزميل", lead: "قيّم مدى تكرار قيام زميلك بكل من هذه السلوكيات." },
    direct_report: { title: "منظور التقرير المباشر", lead: "قيّم مدى تكرار قيام مديرك المباشر بكل من هذه السلوكيات." },
    skip_level: { title: "منظور القائد الأعلى", lead: "قيّم مدى تكرار قيام هذا القائد بكل من هذه السلوكيات." },
    other: { title: "المنظور المتعدد الوظائف", lead: "قيّم مدى تكرار قيام شريكك بكل من هذه السلوكيات." },
  },
} as const;

const UI = {
  en: {
    progressLabel: "rated",
    of: "of",
    saving: "Saving…",
    saved: "All saved",
    failed: "Save failed - will retry",
    submit: "Submit responses",
    submitting: "Saving and submitting…",
    submitDisabled: "Rate every behaviour or mark N/A to submit",
    commentPlaceholder: "Add a short comment (optional)",
    showComment: "Add comment",
    hideComment: "Hide comment",
    offline: "You are offline - your changes will save when you reconnect",
    submitConfirmTitle: "Ready to submit?",
    submitConfirmBody: "Once submitted, you can't change your responses.",
    submitConfirmCta: "Yes, submit",
    submitConfirmCancel: "Keep editing",
    openHeading: "In your own words",
    openLead:
      "These three questions are the most useful part of any 360. Answers are shared with your colleague exactly as written - no edits, no aggregation. Skip any you'd rather not answer.",
    openLeadSelf:
      "These three questions are the most useful part of any 360. Use them to capture what you want to keep, change, or start - they'll appear in your own report exactly as written.",
    openStartLabel: "What should this person START doing to be more effective?",
    openStopLabel: "What should this person STOP doing to be more effective?",
    openContinueLabel: "What should this person CONTINUE doing?",
    openStartLabelSelf: "What do you want to START doing to be more effective?",
    openStopLabelSelf: "What do you want to STOP doing to be more effective?",
    openContinueLabelSelf: "What do you want to CONTINUE doing?",
    openPlaceholder: "Optional - write as much or as little as you like.",
    tenureHeading: "Before you start - how long have you worked with this person?",
    tenureLead: "Optional. Helps the report show the depth of experience behind each piece of feedback.",
    tenureChoices: {
      less_than_6mo: "Less than 6 months",
      six_mo_to_2yr: "6 months - 2 years",
      two_to_5yr: "2 - 5 years",
      over_5yr: "More than 5 years",
    },
    criticalHeading: "Which competencies are most critical for this role?",
    criticalLeadSelf:
      "Pick the competencies you consider most critical for your role. Your manager picks independently - the alignment between your picks (and theirs) is itself a coaching moment.",
    criticalLeadManager:
      "Pick the competencies you consider most critical for this person's role. They've picked independently - the alignment between your picks and theirs is itself a coaching moment.",
    criticalPickedCount: "picked",
  },
  ar: {
    progressLabel: "تم تقييمها",
    of: "من",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ الكل",
    failed: "تعذّر الحفظ - ستتم إعادة المحاولة",
    submit: "إرسال الإجابات",
    submitting: "جارٍ الحفظ والإرسال…",
    submitDisabled: "قيّم كل سلوك أو حدّد \"غير قابل للملاحظة\" قبل الإرسال",
    commentPlaceholder: "أضف تعليقًا قصيرًا (اختياري)",
    showComment: "إضافة تعليق",
    hideComment: "إخفاء التعليق",
    offline: "أنت غير متصل بالإنترنت - ستُحفظ تغييراتك عند عودة الاتصال",
    submitConfirmTitle: "هل أنت جاهز للإرسال؟",
    submitConfirmBody: "بعد الإرسال، لن تتمكن من تعديل إجاباتك.",
    submitConfirmCta: "نعم، أرسل",
    submitConfirmCancel: "متابعة التعديل",
    openHeading: "بكلماتك الخاصة",
    openLead:
      "هذه الأسئلة الثلاثة من أهم ما يخرج به أي تقييم 360. تُشارَك إجاباتك مع زميلك كما هي بالضبط - دون تعديل أو دمج. يمكنك تجاوز أي منها إن لم ترغب في الإجابة.",
    openLeadSelf:
      "هذه الأسئلة الثلاثة من أهم ما يخرج به أي تقييم 360. استخدمها لتسجيل ما تريد الاستمرار فيه وتغييره والبدء به - وستظهر في تقريرك كما كتبتها تمامًا.",
    openStartLabel: "ما الذي ينبغي على هذا الشخص أن يبدأ بفعله ليصبح أكثر فاعلية؟",
    openStopLabel: "ما الذي ينبغي على هذا الشخص أن يتوقّف عن فعله ليصبح أكثر فاعلية؟",
    openContinueLabel: "ما الذي ينبغي على هذا الشخص الاستمرار في فعله؟",
    openStartLabelSelf: "ما الذي تريد أن تبدأ بفعله لتصبح أكثر فاعلية؟",
    openStopLabelSelf: "ما الذي تريد أن تتوقّف عن فعله لتصبح أكثر فاعلية؟",
    openContinueLabelSelf: "ما الذي تريد الاستمرار في فعله؟",
    openPlaceholder: "اختياري - اكتب بقدر ما تشاء.",
    tenureHeading: "قبل أن تبدأ - منذ متى تعمل مع هذا الشخص؟",
    tenureLead: "اختياري. يساعد في أن يُظهر التقرير عمق الخبرة وراء كل رأي.",
    tenureChoices: {
      less_than_6mo: "أقل من 6 أشهر",
      six_mo_to_2yr: "من 6 أشهر إلى سنتين",
      two_to_5yr: "من سنتين إلى 5 سنوات",
      over_5yr: "أكثر من 5 سنوات",
    },
    criticalHeading: "ما الكفايات الأكثر أهمية لهذا الدور؟",
    criticalLeadSelf:
      "اختر الكفايات التي تعتبرها الأكثر أهمية لدورك. سيختار مديرك بشكل مستقل - والتوافق بين اختياراتك (واختياراته) يُعدّ في حدّ ذاته فرصةً للتعلّم.",
    criticalLeadManager:
      "اختر الكفايات التي تعتبرها الأكثر أهمية لدور هذا الشخص. لقد اختار/ت بشكل مستقل - والتوافق بين اختياراتك واختياراته يُعدّ في حدّ ذاته فرصةً للتعلّم.",
    criticalPickedCount: "تم اختيارها",
  },
} as const;

type Props = {
  ctx: RaterContext;
};

export function RaterForm({ ctx }: Props) {
  const router = useRouter();
  const [language, setLanguage] = useState<"en" | "ar">(ctx.rater.language_preference);
  const rtl = language === "ar";
  const t = UI[language];
  const scale = SCALE_LABELS[language];
  const framing = ROLE_FRAMING[language][ctx.rater.rater_role];

  // ──────────────────────────────────────────────────────────
  // Local state per behaviour. Seeded from already-saved responses.
  // ──────────────────────────────────────────────────────────
  const initial: Record<string, LocalAnswer> = useMemo(() => {
    const m: Record<string, LocalAnswer> = {};
    for (const c of ctx.competencies) {
      for (const b of c.behaviors) {
        const r = ctx.responses.get(b.id);
        m[b.id] = {
          score: r?.score ?? null,
          is_na: r?.is_na ?? false,
          comment_text: r?.comment_text ?? "",
        };
      }
    }
    return m;
  }, [ctx]);

  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>(initial);
  const [openText, setOpenText] = useState<{ start: string; stop: string; continue_: string }>({
    start: ctx.openResponses.start,
    stop: ctx.openResponses.stop,
    continue_: ctx.openResponses.continue_,
  });
  // P1: Self + Manager critical-competency picks. Other roles never see
  // the picker so the set stays empty for them.
  const [criticalPicks, setCriticalPicks] = useState<Set<string>>(
    () => new Set(ctx.criticalCompetencyIds)
  );
  const showCriticalPicker =
    ctx.rater.rater_role === "self" || ctx.rater.rater_role === "manager";

  // P2: tenure - "how long have you known this person?" Self raters skip
  // this since they're rating themselves.
  const [tenure, setTenureState] = useState<ReflectRaterTenure | null>(ctx.tenure);
  const showTenurePicker = ctx.rater.rater_role !== "self";

  const setTenure = (next: ReflectRaterTenure | null) => {
    setTenureState(next);
    setSaveState("saving");
    const myId = ++saveIdRef.current;
    const p = (async () => {
      try {
        const res = await saveReflectRaterTenure({
          token: ctx.rater.access_token,
          tenure: next,
        });
        if (!res.ok) {
          setSaveState("failed");
          return;
        }
      } catch {
        setSaveState("failed");
      } finally {
        inflightRef.current.delete(myId);
        if (inflightRef.current.size === 0) {
          setSaveState((cur) => (cur === "failed" ? cur : "idle"));
        }
      }
    })();
    inflightRef.current.set(myId, p);
  };
  const [saveState, setSaveState] = useState<"idle" | "saving" | "failed">("idle");
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [showCommentFor, setShowCommentFor] = useState<Set<string>>(() => {
    // Auto-expand comment fields that already have content
    const s = new Set<string>();
    for (const [bid, a] of Object.entries(initial)) {
      if (a.comment_text) s.add(bid);
    }
    return s;
  });
  const [isOnline, setIsOnline] = useState(true);
  const [submitting, startSubmitting] = useTransition();

  // Track every in-flight save by a unique counter id so the submit-flush
  // gate can await every one of them before calling markComplete. Keying
  // by behavior_id would lose entries when the same behaviour is updated
  // twice in quick succession - the first save's cleanup would delete the
  // second save's promise. Counter ids guarantee each save is tracked
  // until it actually resolves. Same race-fix posture as ARA commit b0e32ee.
  const inflightRef = useRef<Map<number, Promise<void>>>(new Map());
  const saveIdRef = useRef(0);

  // Mirror of `answers` so the score/NA handlers can read the latest value
  // without putting the save side-effect inside the setAnswers updater (which
  // delayed the visual selection). The highlight now paints immediately.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Debounced comment saves - comments are typed character by character
  // so we debounce 700ms before firing the network request.
  const commentTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Same pattern for Start / Stop / Continue free-text. Keyed by kind so
  // a fast typist doesn't fire 30 saves while drafting a single answer.
  const openTimersRef = useRef<
    Map<"start" | "stop" | "continue", ReturnType<typeof setTimeout>>
  >(new Map());

  const persistOpen = (kind: "start" | "stop" | "continue", text: string) => {
    setSaveState("saving");
    const myId = ++saveIdRef.current;
    const p = (async () => {
      try {
        const res = await saveReflectOpenResponse({
          token: ctx.rater.access_token,
          kind,
          text,
        });
        if (!res.ok) {
          setSaveState("failed");
          return;
        }
      } catch {
        setSaveState("failed");
      } finally {
        inflightRef.current.delete(myId);
        if (inflightRef.current.size === 0) {
          setSaveState((cur) => (cur === "failed" ? cur : "idle"));
        }
      }
    })();
    inflightRef.current.set(myId, p);
    return p;
  };

  // P1: critical-competency toggle. No debounce needed - each click is a
  // discrete user intent, same as a score click. The save goes through the
  // same inflight-tracking Map as everything else so the submit-flush gate
  // covers it without extra work.
  const toggleCritical = (competencyId: string) => {
    setCriticalPicks((prev) => {
      const next = new Set(prev);
      if (next.has(competencyId)) next.delete(competencyId);
      else next.add(competencyId);
      // Fire save with the NEXT snapshot. setState is async, so we can't
      // read it back synchronously - but `next` is the value we just built.
      setSaveState("saving");
      const myId = ++saveIdRef.current;
      const p = (async () => {
        try {
          const res = await saveReflectCriticalPicks({
            token: ctx.rater.access_token,
            competency_ids: Array.from(next),
          });
          if (!res.ok) {
            setSaveState("failed");
            return;
          }
        } catch {
          setSaveState("failed");
        } finally {
          inflightRef.current.delete(myId);
          if (inflightRef.current.size === 0) {
            setSaveState((cur) => (cur === "failed" ? cur : "idle"));
          }
        }
      })();
      inflightRef.current.set(myId, p);
      return next;
    });
  };

  const setOpen = (kind: "start" | "stop" | "continue", value: string) => {
    const stateKey = kind === "continue" ? "continue_" : kind;
    setOpenText((prev) => ({ ...prev, [stateKey]: value }));

    const existing = openTimersRef.current.get(kind);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      persistOpen(kind, value);
      openTimersRef.current.delete(kind);
    }, 700);
    openTimersRef.current.set(kind, timer);
  };

  // Online / offline awareness for the banner
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

  const totalBehaviors = useMemo(
    () => ctx.competencies.reduce((s, c) => s + c.behaviors.length, 0),
    [ctx]
  );
  const completed = useMemo(
    () => Object.values(answers).filter((a) => a.score !== null || a.is_na).length,
    [answers]
  );
  const allRated = completed === totalBehaviors;

  // ──────────────────────────────────────────────────────────
  // Single save call. Tracked via inflightRef so the submit gate
  // can flush before marking complete.
  // ──────────────────────────────────────────────────────────
  const persistOne = (behaviorId: string, next: LocalAnswer) => {
    setSaveState("saving");
    const myId = ++saveIdRef.current;
    const p = (async () => {
      try {
        const res = await saveReflectResponse({
          token: ctx.rater.access_token,
          behavior_id: behaviorId,
          score: next.is_na ? null : next.score,
          is_na: next.is_na,
          comment_text: next.comment_text.trim() || null,
        });
        if (!res.ok) {
          setSaveState("failed");
          return;
        }
      } catch {
        setSaveState("failed");
      } finally {
        inflightRef.current.delete(myId);
        if (inflightRef.current.size === 0) {
          setSaveState((cur) => (cur === "failed" ? cur : "idle"));
        }
      }
    })();
    inflightRef.current.set(myId, p);
    return p;
  };

  // ──────────────────────────────────────────────────────────
  // Score change handler - immediate save (no debounce for scores
  // since these are discrete clicks)
  // ──────────────────────────────────────────────────────────
  const setScore = (behaviorId: string, score: number) => {
    const cur = answersRef.current[behaviorId] ?? { score: null, is_na: false, comment_text: "" };
    const next: LocalAnswer = { ...cur, score, is_na: false };
    // Paint the selection immediately (pure update), then save - not inside the
    // updater, so the highlight never waits on the server round-trip.
    answersRef.current = { ...answersRef.current, [behaviorId]: next };
    setAnswers((prev) => ({ ...prev, [behaviorId]: next }));
    persistOne(behaviorId, next);
  };

  const toggleNA = (behaviorId: string) => {
    const cur = answersRef.current[behaviorId] ?? { score: null, is_na: false, comment_text: "" };
    const next: LocalAnswer = cur.is_na
      ? { ...cur, is_na: false }
      : { ...cur, is_na: true, score: null };
    answersRef.current = { ...answersRef.current, [behaviorId]: next };
    setAnswers((prev) => ({ ...prev, [behaviorId]: next }));
    persistOne(behaviorId, next);
  };

  const setComment = (behaviorId: string, value: string) => {
    setAnswers((prev) => {
      const cur = prev[behaviorId] ?? { score: null, is_na: false, comment_text: "" };
      const next: LocalAnswer = { ...cur, comment_text: value };

      // Debounce comment save
      const existing = commentTimersRef.current.get(behaviorId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        persistOne(behaviorId, next);
        commentTimersRef.current.delete(behaviorId);
      }, 700);
      commentTimersRef.current.set(behaviorId, timer);

      return { ...prev, [behaviorId]: next };
    });
  };

  const toggleComment = (behaviorId: string) => {
    setShowCommentFor((prev) => {
      const s = new Set(prev);
      if (s.has(behaviorId)) s.delete(behaviorId);
      else s.add(behaviorId);
      return s;
    });
  };

  // ──────────────────────────────────────────────────────────
  // Submit - flush all in-flight saves + any pending comment
  // debounces, THEN call markReflectRaterComplete. This is the
  // race-safe pattern: never finalize before the last keystroke
  // has reached the DB.
  // ──────────────────────────────────────────────────────────
  const submit = () => {
    setSubmitConfirmOpen(false);

    startSubmitting(async () => {
      // 1. Fire any pending debounced comment saves immediately
      const timers = Array.from(commentTimersRef.current.entries());
      for (const [bid, timer] of Array.from(timers)) {
        clearTimeout(timer);
        commentTimersRef.current.delete(bid);
        const a = answers[bid];
        if (a) persistOne(bid, a);
      }

      // 1b. Fire any pending open-response saves the same way
      const openTimers = Array.from(openTimersRef.current.entries());
      for (const [kind, timer] of Array.from(openTimers)) {
        clearTimeout(timer);
        openTimersRef.current.delete(kind);
        const stateKey = kind === "continue" ? "continue_" : kind;
        persistOpen(kind, openText[stateKey]);
      }

      // 2. Await every in-flight save (the freshly fired ones included)
      const inflight = Array.from(inflightRef.current.values());
      if (inflight.length > 0) await Promise.all(inflight);

      // 3. Now safe to mark complete
      const res = await markReflectRaterComplete(ctx.rater.access_token);
      if (!res.ok) {
        setSaveState("failed");
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="min-h-screen bg-background" dir={rtl ? "rtl" : "ltr"}>
      {!isOnline && (
        <div className="bg-amber-100 text-amber-900 px-4 py-2 text-xs flex items-center gap-2 justify-center border-b border-amber-200">
          <WifiOff className="h-3.5 w-3.5" />
          {t.offline}
        </div>
      )}

      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Aperture className="h-5 w-5 text-accent shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Reflect 360®
                </div>
                <div className="text-sm font-semibold text-primary truncate">
                  {framing.title}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLanguage(language === "en" ? "ar" : "en")}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md border px-2.5 py-1.5"
              >
                <Globe className="h-3.5 w-3.5" />
                {language === "en" ? "العربية" : "English"}
              </button>
              <SaveBadge state={saveState} t={t} />
            </div>
          </div>

          {/* Context line */}
          <div className="mt-3 text-xs text-muted-foreground leading-relaxed">
            {rtl ? "أنت تقدّم تغذية راجعة لـ" : "You're providing feedback for"}{" "}
            <strong className="text-primary">
              {rtl
                ? ctx.participant.full_name_ar ?? ctx.participant.full_name
                : ctx.participant.full_name}
            </strong>
            {ctx.participant.role_title && (
              <span> · {ctx.participant.role_title}</span>
            )}
            {" · "}
            <span>{ctx.engagement.name}</span>
          </div>

          {/* Progress */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{
                  width: totalBehaviors === 0 ? "0%" : `${(completed / totalBehaviors) * 100}%`,
                }}
              />
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {completed} {t.of} {totalBehaviors} {t.progressLabel}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-6 py-6 space-y-8">
        {/* Intro */}
        <section className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {framing.lead}
          </p>
          <ScaleLegend scale={scale} rtl={rtl} />
        </section>

        {/* P2: Rater tenure picker (everyone except Self) */}
        {showTenurePicker && (
          <section className="rounded-lg border bg-card p-5 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-primary">{t.tenureHeading}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t.tenureLead}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                ["less_than_6mo", "six_mo_to_2yr", "two_to_5yr", "over_5yr"] as const
              ).map((bucket) => {
                const selected = tenure === bucket;
                return (
                  <button
                    key={bucket}
                    type="button"
                    onClick={() => setTenure(selected ? null : bucket)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs transition-colors",
                      selected
                        ? "bg-accent text-white border-accent font-medium"
                        : "bg-card text-foreground hover:border-accent/40 hover:bg-accent/5"
                    )}
                  >
                    {t.tenureChoices[bucket]}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Competency sections */}
        {ctx.competencies.map((c) => (
          <section key={c.id} className="space-y-4">
            <div className="border-b pb-2">
              <h2 className="text-base font-semibold text-primary">
                {rtl ? c.name_ar ?? c.name_en : c.name_en}
              </h2>
              {(rtl ? c.description_ar : c.description_en) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {rtl ? c.description_ar : c.description_en}
                </p>
              )}
            </div>

            <ul className="space-y-3">
              {c.behaviors.map((b) => {
                const a = answers[b.id] ?? {
                  score: null,
                  is_na: false,
                  comment_text: "",
                };
                const showComment = showCommentFor.has(b.id);
                return (
                  <li
                    key={b.id}
                    className={cn(
                      "rounded-lg border bg-card p-4 transition-colors",
                      (a.score !== null || a.is_na) && "bg-emerald-50/30 border-emerald-200/60"
                    )}
                  >
                    <p className="text-sm text-primary leading-relaxed">
                      {rtl ? b.text_ar ?? b.text_en : b.text_en}
                    </p>

                    {/* Scale buttons. A11y: the 1-5 + NA choices form a single
                        radio group so screen readers announce them as one
                        control with the BARS descriptor, not five unlabelled
                        buttons. */}
                    <div
                      className="mt-3 flex items-center gap-1.5 flex-wrap"
                      role="radiogroup"
                      aria-label={rtl ? b.text_ar ?? b.text_en : b.text_en}
                    >
                      {[1, 2, 3, 4, 5].map((n) => {
                        const selected = a.score === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={`${n} - ${scale[n as 1 | 2 | 3 | 4 | 5]}`}
                            onClick={() => setScore(b.id, n)}
                            className={cn(
                              "rounded-md border h-9 min-w-[2.5rem] px-2 text-sm transition-colors",
                              selected
                                ? "bg-accent text-white border-accent font-semibold"
                                : "bg-card hover:border-accent/50 hover:bg-accent/5"
                            )}
                            title={scale[n as 1 | 2 | 3 | 4 | 5]}
                          >
                            {n}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        role="radio"
                        aria-checked={a.is_na}
                        aria-label={scale.na}
                        onClick={() => toggleNA(b.id)}
                        className={cn(
                          "rounded-md border h-9 px-3 text-xs transition-colors",
                          a.is_na
                            ? "bg-muted text-foreground border-foreground/30 font-medium"
                            : "bg-card hover:border-foreground/30 text-muted-foreground"
                        )}
                      >
                        {scale.na}
                      </button>

                      <button
                        type="button"
                        aria-expanded={showComment}
                        onClick={() => toggleComment(b.id)}
                        className="text-xs text-muted-foreground hover:text-foreground ms-auto"
                      >
                        {showComment ? t.hideComment : t.showComment}
                      </button>
                    </div>

                    {/* Comment */}
                    {showComment && (
                      <textarea
                        className="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        rows={2}
                        placeholder={t.commentPlaceholder}
                        dir={rtl ? "rtl" : "ltr"}
                        value={a.comment_text}
                        onChange={(e) => setComment(b.id, e.target.value)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {/* P1: Critical-competency picks (Self + Manager only) */}
        {showCriticalPicker && (
          <section className="rounded-lg border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-primary">{t.criticalHeading}</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {ctx.rater.rater_role === "self" ? t.criticalLeadSelf : t.criticalLeadManager}
              </p>
              <p className="text-[11px] text-muted-foreground mt-2 tabular-nums">
                {criticalPicks.size} {t.criticalPickedCount}
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {ctx.competencies.map((c) => {
                const picked = criticalPicks.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-pressed={picked}
                      onClick={() => toggleCritical(c.id)}
                      className={cn(
                        "w-full text-start rounded-md border px-3 py-2 text-sm leading-snug transition-colors",
                        picked
                          ? "bg-accent/10 border-accent text-primary font-medium"
                          : "bg-card hover:border-accent/40 hover:bg-accent/5 text-foreground"
                      )}
                      dir={rtl ? "rtl" : "ltr"}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center h-4 w-4 rounded-sm border shrink-0",
                            picked ? "bg-accent border-accent text-white" : "bg-card border-border"
                          )}
                        >
                          {picked ? "✓" : ""}
                        </span>
                        <span>{rtl ? c.name_ar ?? c.name_en : c.name_en}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Start / Stop / Continue */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-primary">{t.openHeading}</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {ctx.rater.rater_role === "self" ? t.openLeadSelf : t.openLead}
            </p>
          </div>
          <OpenQuestion
            label={ctx.rater.rater_role === "self" ? t.openStartLabelSelf : t.openStartLabel}
            placeholder={t.openPlaceholder}
            value={openText.start}
            onChange={(v) => setOpen("start", v)}
            rtl={rtl}
          />
          <OpenQuestion
            label={ctx.rater.rater_role === "self" ? t.openStopLabelSelf : t.openStopLabel}
            placeholder={t.openPlaceholder}
            value={openText.stop}
            onChange={(v) => setOpen("stop", v)}
            rtl={rtl}
          />
          <OpenQuestion
            label={ctx.rater.rater_role === "self" ? t.openContinueLabelSelf : t.openContinueLabel}
            placeholder={t.openPlaceholder}
            value={openText.continue_}
            onChange={(v) => setOpen("continue", v)}
            rtl={rtl}
          />
        </section>

        {/* Five open-ended questions (00101) - autosave on blur, independent of the SSC machine */}
        <section className="rounded-lg border bg-card p-5">
          <OpenQuestionsBlock
            token={ctx.rater.access_token}
            isSelf={ctx.rater.rater_role === "self"}
            ar={rtl}
            initial={ctx.openQuestions}
          />
        </section>

        {/* Submit rail */}
        <section className="rounded-lg border bg-card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-muted-foreground">
              {allRated ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {rtl
                    ? "تم تقييم جميع السلوكيات. يمكنك المراجعة قبل الإرسال."
                    : "Every behaviour rated. Review and submit when you're ready."}
                </span>
              ) : (
                <span>{t.submitDisabled}</span>
              )}
            </div>
            <button
              type="button"
              disabled={!allRated || submitting}
              onClick={() => setSubmitConfirmOpen(true)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors",
                (!allRated || submitting) && "opacity-50 cursor-not-allowed",
                allRated && !submitting && "hover:bg-accent/90"
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.submitting}
                </>
              ) : (
                <>
                  {t.submit}
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </section>
      </main>

      {/* Confirm-submit modal */}
      {submitConfirmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
          <div className="bg-card rounded-xl border p-6 max-w-md w-full" dir={rtl ? "rtl" : "ltr"}>
            <h3 className="text-base font-semibold text-primary">{t.submitConfirmTitle}</h3>
            <p className="text-sm text-muted-foreground mt-2">{t.submitConfirmBody}</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSubmitConfirmOpen(false)}
                className="rounded-md border px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                {t.submitConfirmCancel}
              </button>
              <button
                type="button"
                onClick={submit}
                className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:bg-accent/90"
              >
                {t.submitConfirmCta}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScaleLegend({
  scale,
  rtl,
}: {
  scale: (typeof SCALE_LABELS)["en"] | (typeof SCALE_LABELS)["ar"];
  rtl: boolean;
}) {
  return (
    <div className="mt-4 grid gap-1 sm:grid-cols-5 text-[11px] text-muted-foreground">
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-muted text-foreground font-medium">
            {n}
          </span>
          <span className={cn(rtl && "text-end")}>{scale[n as 1 | 2 | 3 | 4 | 5]}</span>
        </div>
      ))}
    </div>
  );
}

function OpenQuestion({
  label,
  placeholder,
  value,
  onChange,
  rtl,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  rtl: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary mb-1.5 leading-snug">
        {label}
      </label>
      <textarea
        className="w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed"
        rows={3}
        placeholder={placeholder}
        dir={rtl ? "rtl" : "ltr"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={2000}
      />
    </div>
  );
}

function SaveBadge({
  state,
  t,
}: {
  state: "idle" | "saving" | "failed";
  t: (typeof UI)["en"] | (typeof UI)["ar"];
}) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t.saving}
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-rose-700">
        {t.failed}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
      <CheckCircle2 className="h-3 w-3" />
      {t.saved}
    </span>
  );
}
