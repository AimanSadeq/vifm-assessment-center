"use client";

import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, Sparkles, RotateCcw, BookOpen, PenLine, CheckCircle2,
  Headphones, Mic, Square, Play, Volume2, Award, AlertCircle,
} from "lucide-react";
import { startBrowserStt, type BrowserSttSession } from "@/lib/speech/browser-stt";
import { FluentDefinitions } from "./fluent-definitions";
import {
  computeIntegritySignal,
  type IntegrityEvent,
  type IntegritySignal,
} from "@/lib/scoring/integrity";

type Language = "en" | "ar";
type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
type PronunciationLike = { accuracy: number; fluency: number; completeness: number; prosody: number | null; pron: number };

type ReadingItem = {
  id: string; passage: string; question: string; options: string[]; cefr: Cefr;
};
type ListeningItem = {
  id: string; script?: string; question: string; options: string[]; cefr: Cefr;
};
type WritingTask = {
  id: string; prompt_en: string; prompt_ar: string | null; cefr_target: Cefr; min_words: number;
};
type SpeakingTask = {
  id: string; prompt_en: string; prompt_ar: string | null; cefr_target: Cefr; min_seconds: number;
};
type FluentTest = {
  reading: ReadingItem[]; listening: ListeningItem[]; writing: WritingTask; speaking: SpeakingTask; ai_generated: boolean; tts?: boolean;
};
type WritingScore = {
  cefr: Cefr; task_achievement: number; coherence: number; lexical_range: number; grammar: number;
  register: number; etiquette: number; mechanics: number;
  feedback_en: string; feedback_ar: string | null; ai_generated: boolean;
};
type SpeakingScore = {
  attempted: boolean; cefr: Cefr; fluency: number; coherence: number; lexical_range: number; grammar: number;
  transcript: string; feedback_en: string; feedback_ar: string | null; ai_generated: boolean;
  pronunciation?: number; azure?: PronunciationLike | null;
};
type ConfidenceBand = { overall: Cefr; low: Cefr; high: Cefr; halfWidth: number; underpowered: boolean; receptiveItems: number };
type FluentResult = {
  overall_cefr: Cefr; reading_correct: number; reading_total: number; reading_cefr: Cefr;
  listening_correct: number; listening_total: number; listening_cefr: Cefr;
  writing: WritingScore; speaking: SpeakingScore; result_id?: string | null;
  reliability?: ConfidenceBand;
  integrity?: IntegritySignal;
};

const bandText = (r: ConfidenceBand): string => (r.low === r.high ? r.low : `${r.low}–${r.high}`);

const MAX_PLAYS = 2;

const T = {
  en: {
    start: "Start placement test", starting: "Building your test…",
    reading: "Reading", listening: "Listening", writing: "Writing", speaking: "Speaking",
    words: "words", min: "min", submit: "Submit for scoring", scoring: "Scoring your responses…",
    yourLevel: "Your indicative level", overall: "Overall",
    range: "Indicative range", indicative: "short test, wide margin",
    readingScore: "Reading", listeningScore: "Listening", writingScore: "Writing", speakingScore: "Speaking",
    feedback: "Examiner feedback", startOver: "Start over", correct: "correct",
    writeCrit: { task_achievement: "Task achievement", coherence: "Coherence & cohesion", lexical_range: "Lexical resource", grammar: "Grammar range & accuracy", register: "Register (business-like)", etiquette: "Etiquette & courtesy", mechanics: "Spelling & punctuation" },
    speakCrit: { fluency: "Fluency", coherence: "Coherence & cohesion", lexical_range: "Lexical resource", grammar: "Grammar range & accuracy" },
    pronunciation: "Pronunciation (acoustic)", azureNote: "Acoustic analysis",
    writeHere: "Write your response here…", pickLang: "Test language", target: "Target",
    proctorNote: "Integrity monitoring is on - tab switches, time away from the test, and pasting are recorded (advisory only; this never auto-fails your test).",
    nameLabel: "Your name (optional)", emailLabel: "Email (optional)",
    namePlaceholder: "e.g. Sara Al Mansoori", emailPlaceholder: "you@example.com",
    listenHint: "Listen, then answer. You can replay each clip up to twice.",
    play: "Play", playing: "Playing…", replaysLeft: "replays left", noTts: "Audio playback isn't available here - the script is shown so you can still answer.",
    speakHint: "Record about 45 seconds. We transcribe your speech and assess it.",
    record: "Record", stop: "Stop", recording: "Recording", transcribing: "Transcribing your speech…",
    yourTranscript: "What we heard", reRecord: "Re-record", typeInstead: "Type instead", recordInstead: "Record instead",
    speakTypeHere: "Type roughly what you would say…", micDenied: "Microphone not available. You can type your answer instead.",
    transcribeFailed: "Transcription didn't work. You can type your answer instead.",
    noSpeech: "We didn't catch any speech. Please record again.",
    listening_live: "Listening…",
    optional: "optional", required: "required", certificate: "Download report", resultFor: "Result for",
    transcriptHeading: "Your transcript",
    beginTitle: "Begin your placement",
    beginSub: "About {min} minutes · four skills · an indicative CEFR level the moment you finish.",
    howToTitle: "How to answer",
    howReading: "Reading & Listening: choose the best answer; listening items have audio you can replay.",
    howWriting: "Writing: type your response; write naturally and stay on the topic.",
    howSpeaking: "Speaking: allow microphone access and speak clearly when prompted.",
    prep1: "Find a quiet place; the speaking part needs a working microphone.",
    prep2: "Take your time and do your own work - it gives the most useful placement.",
    incompleteTitle: "A few things still need an answer before you can submit:",
    nUnanswered: "unanswered question(s)",
    writingTooShort: "Writing response is too short",
    speakingNeeded: "A spoken (or typed) response is required",
    jumpToFirst: "Go to the first unanswered question",
    notAnswered: "Not answered",
    timeRemaining: "Time remaining",
    warn2min: "About 2 minutes left - the test submits automatically when time runs out.",
    warn1min: "Less than a minute left - the test will submit automatically.",
    integrityHeading: "Integrity signal",
    integrityNote: "Advisory only - this never affects your level or auto-fails the test.",
    integrityTier: { clean: "Clean", minor: "Minor activity", elevated: "Elevated activity" },
  },
  ar: {
    start: "ابدأ اختبار تحديد المستوى", starting: "جارٍ إعداد اختبارك…",
    reading: "القراءة", listening: "الاستماع", writing: "الكتابة", speaking: "التحدث",
    words: "كلمة", min: "الحد الأدنى", submit: "أرسل للتقييم", scoring: "جارٍ تقييم إجاباتك…",
    yourLevel: "مستواك التقريبي", overall: "الإجمالي",
    range: "النطاق التقريبي", indicative: "اختبار قصير، هامش واسع",
    readingScore: "القراءة", listeningScore: "الاستماع", writingScore: "الكتابة", speakingScore: "التحدث",
    feedback: "ملاحظات المُقيّم", startOver: "ابدأ من جديد", correct: "صحيحة",
    writeCrit: { task_achievement: "تحقيق المهمة", coherence: "الترابط والتماسك", lexical_range: "الثروة اللغوية", grammar: "القواعد ودقتها", register: "الأسلوب المهني", etiquette: "اللياقة والكياسة", mechanics: "الإملاء وعلامات الترقيم" },
    speakCrit: { fluency: "الطلاقة", coherence: "الترابط والتماسك", lexical_range: "الثروة اللغوية", grammar: "القواعد ودقتها" },
    pronunciation: "النطق (صوتيًا)", azureNote: "تحليل صوتي",
    writeHere: "اكتب إجابتك هنا…", pickLang: "لغة الاختبار", target: "المستوى المستهدف",
    proctorNote: "مراقبة النزاهة مُفعّلة - يُسجَّل تبديل التبويبات والوقت بعيدًا عن الاختبار واللصق (استرشادية فقط؛ لا تُرسِب اختبارك تلقائيًا).",
    nameLabel: "اسمك (اختياري)", emailLabel: "البريد الإلكتروني (اختياري)",
    namePlaceholder: "مثال: سارة المنصوري", emailPlaceholder: "you@example.com",
    listenHint: "استمع ثم أجب. يمكنك إعادة تشغيل كل مقطع مرتين كحدٍّ أقصى.",
    play: "تشغيل", playing: "جارٍ التشغيل…", replaysLeft: "إعادة متبقية", noTts: "تشغيل الصوت غير متاح هنا - يظهر النص لتتمكن من الإجابة.",
    speakHint: "سجّل نحو 45 ثانية. نقوم بتفريغ كلامك وتقييمه.",
    record: "تسجيل", stop: "إيقاف", recording: "جارٍ التسجيل", transcribing: "جارٍ تفريغ كلامك…",
    yourTranscript: "ما سمعناه", reRecord: "إعادة التسجيل", typeInstead: "اكتب بدلاً من ذلك", recordInstead: "سجّل بدلاً من ذلك",
    speakTypeHere: "اكتب تقريبًا ما كنت ستقوله…", micDenied: "الميكروفون غير متاح. يمكنك كتابة إجابتك بدلاً من ذلك.",
    transcribeFailed: "تعذّر التفريغ. يمكنك كتابة إجابتك بدلاً من ذلك.",
    noSpeech: "لم نلتقط أي كلام. يُرجى التسجيل مرة أخرى.",
    listening_live: "جارٍ الاستماع…",
    optional: "اختياري", required: "إلزامي", certificate: "تنزيل التقرير", resultFor: "نتيجة",
    transcriptHeading: "نص كلامك",
    beginTitle: "ابدأ تحديد مستواك",
    beginSub: "نحو {min} دقيقة · أربع مهارات · مستوى CEFR تقريبي فور انتهائك.",
    howToTitle: "كيفية الإجابة",
    howReading: "القراءة والاستماع: اختر الإجابة الأنسب؛ بنود الاستماع تتضمّن صوتًا يمكنك إعادة تشغيله.",
    howWriting: "الكتابة: اكتب إجابتك بأسلوب طبيعي والتزم بالموضوع.",
    howSpeaking: "التحدث: اسمح باستخدام الميكروفون وتحدّث بوضوح عند الطلب.",
    prep1: "اختر مكانًا هادئًا؛ يحتاج قسم التحدث إلى ميكروفون يعمل.",
    prep2: "خذ وقتك وأجب بنفسك - فهذا يمنح أدقّ تحديد للمستوى.",
    incompleteTitle: "بقيت بعض العناصر التي تحتاج إجابة قبل الإرسال:",
    nUnanswered: "سؤال دون إجابة",
    writingTooShort: "إجابة الكتابة قصيرة جدًا",
    speakingNeeded: "مطلوب رد منطوق (أو مكتوب)",
    jumpToFirst: "انتقل إلى أول سؤال دون إجابة",
    notAnswered: "دون إجابة",
    timeRemaining: "الوقت المتبقي",
    warn2min: "بقي نحو دقيقتين - يُرسَل الاختبار تلقائيًا عند انتهاء الوقت.",
    warn1min: "بقي أقل من دقيقة - سيُرسَل الاختبار تلقائيًا.",
    integrityHeading: "إشارة النزاهة",
    integrityNote: "استرشادية فقط - لا تؤثّر على مستواك ولا تُرسِب الاختبار تلقائيًا.",
    integrityTier: { clean: "سليم", minor: "نشاط طفيف", elevated: "نشاط مرتفع" },
  },
} as const;

const CEFR_TONE: Record<Cefr, string> = {
  A1: "bg-rose-100 text-rose-800 border-rose-300",
  A2: "bg-amber-100 text-amber-800 border-amber-300",
  B1: "bg-sky-100 text-sky-800 border-sky-300",
  B2: "bg-blue-100 text-blue-800 border-blue-300",
  C1: "bg-emerald-100 text-emerald-800 border-emerald-300",
  C2: "bg-emerald-200 text-emerald-900 border-emerald-400",
};

const ttsAvailable = () =>
  typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

export function FluentClient({
  candidateId = null,
  engagementId = null,
  redemptionToken = null,
  prefillName,
  prefillEmail,
  timerMinutes,
}: {
  candidateId?: string | null;
  engagementId?: string | null;
  /** Voucher redemption token (delegate flow); stamps the result with the client org. */
  redemptionToken?: string | null;
  prefillName?: string;
  prefillEmail?: string;
  /** Admin-configurable time limit (minutes); defaults to 15. */
  timerMinutes?: number;
} = {}) {
  // CAL-FLU-605: undefined = default 15 min; an explicit 0 (or negative) = NO
  // limit (no countdown, no auto-submit) - the old `|| 15` silently forced a
  // deliberate no-limit back to 15.
  const hasTimeLimit = timerMinutes === undefined || timerMinutes > 0;
  const limitMinutes = timerMinutes && timerMinutes > 0 ? timerMinutes : 15;
  const [language, setLanguage] = useState<Language>("en");
  const [phase, setPhase] = useState<"intro" | "test" | "result">("intro");
  // CAL-FLU-604: reveal which questions block submission (set on a blocked click).
  const [showGaps, setShowGaps] = useState(false);
  // Countdown: deadline is stamped when the test starts; on expiry, auto-submit.
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [test, setTest] = useState<FluentTest | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [writing, setWriting] = useState("");
  const [result, setResult] = useState<FluentResult | null>(null);
  // XP-13: only VIFM staff (admin/consultant/assessor) see results on-screen;
  // a delegate/anonymous taker gets a thank-you. Server-decided via isStaff.
  const [canView, setCanView] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Taker identity (self-entered, or prefilled from a bound candidate).
  const [takerName, setTakerName] = useState(prefillName ?? "");
  const [takerEmail, setTakerEmail] = useState(prefillEmail ?? "");

  // Lightweight proctoring signals (CAL-FLU-601, advisory only - never auto-fail).
  // PDPL-safe: we keep counts, away-DURATION, and the LENGTH of pasted text only,
  // never the pasted content itself.
  const [blurCount, setBlurCount] = useState(0);
  const [pasteCount, setPasteCount] = useState(0);
  const [awayMs, setAwayMs] = useState(0);
  const [pasteChars, setPasteChars] = useState(0);
  const [events, setEvents] = useState<IntegrityEvent[]>([]);
  const testStartRef = useRef<number>(0);

  // Listening playback state.
  const [plays, setPlays] = useState<Record<string, number>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Speaking state.
  const [speakMode, setSpeakMode] = useState<"record" | "type">("record");
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [pronunciation, setPronunciation] = useState<PronunciationLike | null>(null);
  const [speakNote, setSpeakNote] = useState("");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Browser-native speech-to-text (primary path - free, no server, works on Render).
  const sttRef = useRef<BrowserSttSession | null>(null);
  const usingSttRef = useRef(false);

  const t = T[language];
  const rtl = language === "ar";

  // Stop TTS + recording if the component unmounts mid-flow.
  useEffect(() => {
    return () => {
      if (ttsAvailable()) window.speechSynthesis.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      sttRef.current?.abort();
    };
  }, []);

  // Proctoring (CAL-FLU-601): capture tab-hide / window-blur AWAY DURATION while
  // the test runs. Covers tab switch + minimise (visibilitychange) AND same-window
  // focus loss like a second monitor or devtools (window blur/focus, which
  // document.hidden misses). A 1.5s debounce ignores brief/benign focus loss
  // (file pickers, alerts). visibilitychange + blur can overlap on one tab switch;
  // a single awayStart guard prevents double counting. Advisory signal only.
  useEffect(() => {
    if (phase !== "test") return;
    testStartRef.current = Date.now();
    const AWAY_DEBOUNCE_MS = 1500;
    let awayStart: number | null = null;
    const goneAway = () => { if (awayStart == null) awayStart = Date.now(); };
    const cameBack = () => {
      if (awayStart == null) return;
      const dur = Date.now() - awayStart;
      awayStart = null;
      if (dur < AWAY_DEBOUNCE_MS) return;
      const at = Date.now() - testStartRef.current;
      setBlurCount((c) => c + 1);
      setAwayMs((m) => m + dur);
      setEvents((ev) => [...ev, { kind: "blur", at, awayMs: dur }]);
    };
    const onVis = () => { if (document.hidden) goneAway(); else cameBack(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", goneAway);
    window.addEventListener("focus", cameBack);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", goneAway);
      window.removeEventListener("focus", cameBack);
    };
  }, [phase]);

  // PDPL-safe paste capture: record that a paste happened + the LENGTH of the
  // pasted text (never the text). Used on the writing + speaking-fallback boxes.
  const onPasteCapture = useCallback((e: React.ClipboardEvent) => {
    const len = e.clipboardData?.getData("text")?.length ?? 0;
    const at = Date.now() - (testStartRef.current || Date.now());
    setPasteCount((c) => c + 1);
    if (len > 0) setPasteChars((n) => n + len);
    setEvents((ev) => [...ev, { kind: "paste", at, pasteChars: len }]);
  }, []);

  const playClip = useCallback((item: ListeningItem) => {
    if (!ttsAvailable() || !item.script) return;
    const used = plays[item.id] ?? 0;
    if (used >= MAX_PLAYS) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(item.script);
    u.lang = "en-US";
    u.rate = 0.95;
    const enVoice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("en"));
    if (enVoice) u.voice = enVoice;
    u.onstart = () => setPlayingId(item.id);
    u.onend = () => setPlayingId((cur) => (cur === item.id ? null : cur));
    u.onerror = () => setPlayingId((cur) => (cur === item.id ? null : cur));
    setPlays((p) => ({ ...p, [item.id]: used + 1 }));
    synth.speak(u);
  }, [plays]);

  function endTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function startRecording() {
    setSpeakNote("");
    // Primary: free, in-browser transcription (no server round-trip, works on
    // Render). The transcript streams in live; on stop it flows straight into
    // Claude scoring. Only browsers without the Web Speech API fall through.
    const stt = startBrowserStt({
      onPartial: (text) => setTranscript(text),
      onDone: (finalText) => {
        endTimer();
        setRecording(false);
        usingSttRef.current = false;
        sttRef.current = null;
        setTranscript(finalText);
        if (!finalText) setSpeakNote(t.noSpeech);
      },
      onError: (code) => {
        endTimer();
        setRecording(false);
        usingSttRef.current = false;
        sttRef.current = null;
        setSpeakMode("type");
        setSpeakNote(code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture" ? t.micDenied : t.transcribeFailed);
      },
    });
    if (stt) {
      sttRef.current = stt;
      usingSttRef.current = true;
      setTranscript("");
      setPronunciation(null);
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
      return;
    }
    // Fallback: MediaRecorder → server transcription (e.g. Firefox).
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        void transcribeBlob(blob);
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      setSpeakMode("type");
      setSpeakNote(t.micDenied);
    }
  }

  function stopRecording() {
    // Web Speech path: stop() triggers onDone, which clears the timer + state.
    if (usingSttRef.current && sttRef.current) {
      sttRef.current.stop();
      return;
    }
    endTimer();
    setRecording(false);
    mediaRef.current?.stop();
  }

  async function transcribeBlob(blob: Blob) {
    setTranscribing(true);
    setSpeakNote("");
    try {
      const fd = new FormData();
      fd.append("audio", blob, "speaking.webm");
      const res = await fetch("/api/ac/fluent/transcribe", { method: "POST", body: fd });
      const data = (await res.json()) as { transcript?: string; error?: string; pronunciation?: PronunciationLike | null };
      if (!res.ok || typeof data.transcript !== "string") {
        setSpeakMode("type");
        setSpeakNote(t.transcribeFailed);
      } else {
        setTranscript(data.transcript);
        setPronunciation(data.pronunciation ?? null);
      }
    } catch {
      setSpeakMode("type");
      setSpeakNote(t.transcribeFailed);
    } finally {
      setTranscribing(false);
    }
  }

  async function start() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ac/fluent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", language, candidateId, engagementId }),
      });
      // Secure response: { session_id, test }; legacy response: the test itself.
      const raw = (await res.json()) as (FluentTest & { session_id?: string; test?: FluentTest; tts?: boolean });
      const testData = { ...((raw.test ?? raw) as FluentTest), tts: raw.tts };
      setSessionId(raw.session_id ?? null);
      setTest(testData);
      setAnswers({}); setWriting(""); setResult(null);
      setPlays({}); setPlayingId(null);
      setTranscript(""); setPronunciation(null); setSpeakNote(""); setSpeakMode("record"); setRecSeconds(0);
      setBlurCount(0); setPasteCount(0); setAwayMs(0); setPasteChars(0); setEvents([]);
      if (hasTimeLimit) {
        setDeadline(Date.now() + limitMinutes * 60 * 1000);
        setRemaining(limitMinutes * 60);
      } else {
        setDeadline(null);
        setRemaining(null);
      }
      setPhase("test");
    } catch {
      setError("Could not build the test. Please try again.");
    } finally { setBusy(false); }
  }

  // Countdown + auto-submit when the admin-set time limit runs out.
  useEffect(() => {
    if (phase !== "test" || deadline == null) return;
    const id = setInterval(() => {
      const secs = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        clearInterval(id);
        // CAL-FLU-605: flush an in-flight recording first so the spoken response
        // (browser STT streams interim text into `transcript` live) is captured
        // and the mic is released, rather than auto-submitting mid-recording.
        if (recording) stopRecording();
        if (!busy) void submit();
      }
    }, 1000);
    return () => clearInterval(id);
    // submit/stopRecording are hoisted; deadline/phase/recording drive the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deadline, busy, recording]);

  async function submit() {
    if (!test) return;
    if (ttsAvailable()) window.speechSynthesis.cancel();
    setBusy(true); setError("");
    try {
      const common = {
        action: "score" as const, language, answers,
        writingResponse: writing, speakingTranscript: transcript,
        takerName: takerName.trim() || null, takerEmail: takerEmail.trim() || null,
        integrityFlags: { blurCount, pasteCount, awayMs, pasteChars, events },
        candidateId, engagementId, redemptionToken, pronunciation,
      };
      // Secure: server grades from the stored session. Legacy: post the test.
      const payload = sessionId
        ? { ...common, sessionId }
        : {
            ...common,
            reading: test.reading, listening: test.listening,
            writingTask: test.writing, speakingTask: test.speaking,
            aiGenerated: test.ai_generated,
          };
      const res = await fetch("/api/ac/fluent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as FluentResult & { isStaff?: boolean };
      setResult(data); setCanView(data.isStaff === true); setPhase("result");
    } catch {
      setError("Scoring failed. Please try again.");
    } finally { setBusy(false); }
  }

  function reset() {
    if (ttsAvailable()) window.speechSynthesis.cancel();
    setPhase("intro"); setTest(null); setSessionId(null); setAnswers({}); setWriting(""); setResult(null); setError("");
    setPlays({}); setPlayingId(null);
    setTranscript(""); setPronunciation(null); setSpeakNote(""); setSpeakMode("record"); setRecSeconds(0);
    setBlurCount(0); setPasteCount(0); setAwayMs(0); setPasteChars(0); setEvents([]); setShowGaps(false);
  }

  const wordCount = writing.trim() ? writing.trim().split(/\s+/).length : 0;
  // Speaking is MANDATORY: a spoken (or typed-fallback) response of at least a
  // few words is required before the test can be submitted.
  const speakWordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const receptive = test ? [...test.reading, ...test.listening] : [];

  // CAL-FLU-604: rather than a silently-disabled button, validate on click and
  // tell the candidate exactly what is incomplete + let them jump to it. The
  // timer auto-submit path calls submit() directly and bypasses this gate.
  const unansweredIds = receptive.filter((r) => answers[r.id] == null).map((r) => r.id);
  const writingShort = wordCount < 5;
  const speakingShort = speakWordCount < 3;
  const hasGaps = unansweredIds.length > 0 || writingShort || speakingShort;
  function scrollToGap(id: string) {
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function handleSubmitClick() {
    if (hasGaps) {
      setShowGaps(true);
      const firstId =
        unansweredIds.length > 0
          ? `fluent-q-${unansweredIds[0]}`
          : writingShort
            ? "fluent-writing"
            : "fluent-speaking";
      scrollToGap(firstId);
      return;
    }
    void submit();
  }

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="space-y-5">
      {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {/* ── Intro / start card ── */}
      {phase === "intro" && (
        <div className="rounded-2xl border bg-card p-6 shadow-[0_16px_48px_-12px_rgba(1,1,49,0.18)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#010131]">{t.beginTitle}</h2>
              <p className="mt-1 text-sm text-slate-500">{t.beginSub.replace("{min}", String(limitMinutes))}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{t.pickLang}</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
                {(["en", "ar"] as const).map((l) => (
                  <button key={l} onClick={() => setLanguage(l)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${language === l ? "bg-[#5391D5] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
                    {l === "en" ? "English" : "العربية"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t.nameLabel}</span>
              <input value={takerName} onChange={(e) => setTakerName(e.target.value)} dir="ltr"
                placeholder={t.namePlaceholder}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm transition-colors focus:border-[#5391D5] focus:outline-none focus:ring-2 focus:ring-[#5391D5]/20" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t.emailLabel}</span>
              <input value={takerEmail} onChange={(e) => setTakerEmail(e.target.value)} type="email" dir="ltr"
                placeholder={t.emailPlaceholder}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm transition-colors focus:border-[#5391D5] focus:outline-none focus:ring-2 focus:ring-[#5391D5]/20" />
            </label>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t.howToTitle}</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              {[t.howReading, t.howWriting, t.howSpeaking].map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5391D5]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <ul className="mt-3 space-y-1 text-[13px] text-slate-600">
              <li>· {t.prep1}</li>
              <li>· {t.prep2}</li>
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button onClick={start} disabled={busy}
              className="ara-pulse inline-flex items-center gap-2 rounded-lg bg-[#010131] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#121140] disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? t.starting : t.start}
            </button>
            <span className="text-[11px] text-slate-400">{t.proctorNote}</span>
          </div>
        </div>
      )}

      {/* ── Test ── */}
      {phase === "test" && test && (
        <>
          {remaining != null && (
            <div className="sticky top-0 z-10 space-y-1.5">
              <div
                className={`flex items-center justify-between rounded-lg border px-4 py-2 text-sm shadow-sm ${
                  remaining <= 60 ? "border-rose-300 bg-rose-50 text-rose-700" : remaining <= 120 ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <span>{t.timeRemaining}</span>
                <span className="font-mono font-semibold tabular-nums">
                  {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
                </span>
              </div>
              {/* CAL-FLU-605: stable per-threshold warning (no ticking seconds), so
                  the aria-live region announces once at 2 min and once at 1 min. */}
              {remaining > 0 && remaining <= 120 && (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800"
                >
                  {remaining <= 60 ? t.warn1min : t.warn2min}
                </div>
              )}
            </div>
          )}
          {/* Reading */}
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <BookOpen className="h-5 w-5 text-[#5391D5]" /> {t.reading}
            </h2>
            <div className="space-y-5">
              {test.reading.map((item, i) => {
                const unanswered = showGaps && answers[item.id] == null;
                return (
                  <div
                    key={item.id}
                    id={`fluent-q-${item.id}`}
                    className={`rounded-lg border p-4 ${unanswered ? "border-rose-400 ring-1 ring-rose-300" : "border-slate-200"}`}
                  >
                    <p dir="ltr" className="text-sm text-[#111232]">{item.passage}</p>
                    <p dir="ltr" className="mt-2 text-sm font-semibold text-[#010131]">{i + 1}. {item.question}</p>
                    <Options item={item} answers={answers} setAnswers={setAnswers} />
                    {unanswered && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-rose-600">
                        <AlertCircle className="h-3.5 w-3.5" /> {t.notAnswered}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Listening */}
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-1 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <Headphones className="h-5 w-5 text-[#5391D5]" /> {t.listening}
            </h2>
            <p className="mb-4 text-xs text-slate-500">{t.listenHint}</p>
            {!ttsAvailable() && (
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                <AlertCircle className="h-3.5 w-3.5" /> {t.noTts}
              </div>
            )}
            <div className="space-y-5">
              {test.listening.map((item, i) => {
                const used = plays[item.id] ?? 0;
                const isPlaying = playingId === item.id;
                const unanswered = showGaps && answers[item.id] == null;
                return (
                  <div
                    key={item.id}
                    id={`fluent-q-${item.id}`}
                    className={`rounded-lg border p-4 ${unanswered ? "border-rose-400 ring-1 ring-rose-300" : "border-slate-200"}`}
                  >
                    <div className="flex items-center gap-3">
                      {test.tts && sessionId ? (
                        <audio
                          controls
                          preload="none"
                          className="h-9 w-full max-w-xs"
                          src={`/api/ac/fluent/tts?session=${sessionId}&item=${encodeURIComponent(item.id)}${redemptionToken ? `&token=${encodeURIComponent(redemptionToken)}` : ""}`}
                        />
                      ) : ttsAvailable() ? (
                        <>
                          <button onClick={() => playClip(item)} disabled={used >= MAX_PLAYS || isPlaying}
                            className="inline-flex items-center gap-1.5 rounded-md bg-[#5391D5] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4380c4] disabled:opacity-50">
                            {isPlaying ? <Volume2 className="h-3.5 w-3.5 animate-pulse" /> : <Play className="h-3.5 w-3.5" />}
                            {isPlaying ? t.playing : t.play}
                          </button>
                          <span className="text-[11px] text-slate-400">{Math.max(0, MAX_PLAYS - used)} {t.replaysLeft}</span>
                        </>
                      ) : (
                        <p dir="ltr" className="text-sm italic text-slate-600">“{item.script}”</p>
                      )}
                    </div>
                    <p dir="ltr" className="mt-3 text-sm font-semibold text-[#010131]">{i + 1}. {item.question}</p>
                    <Options item={item} answers={answers} setAnswers={setAnswers} />
                    {unanswered && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-rose-600">
                        <AlertCircle className="h-3.5 w-3.5" /> {t.notAnswered}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Writing */}
          <section
            id="fluent-writing"
            className={`rounded-xl border bg-white p-6 shadow-sm ${showGaps && writingShort ? "border-rose-400 ring-1 ring-rose-300" : ""}`}
          >
            <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <PenLine className="h-5 w-5 text-[#5391D5]" /> {t.writing}
            </h2>
            <p dir="ltr" className="text-sm text-[#111232]">{test.writing.prompt_en}</p>
            {rtl && test.writing.prompt_ar && (
              <p dir="rtl" className="mt-1 text-sm text-slate-600">{test.writing.prompt_ar}</p>
            )}
            <textarea value={writing} onChange={(e) => setWriting(e.target.value)} rows={7}
              onPaste={onPasteCapture}
              placeholder={t.writeHere} dir="ltr"
              className="mt-3 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-[#111232] focus:border-[#5391D5] focus:outline-none" />
            <div className={`mt-1 text-[11px] ${wordCount >= test.writing.min_words ? "font-semibold text-emerald-600" : "text-slate-500"}`}>
              {wordCount} {t.words} · {t.min} {test.writing.min_words}
            </div>
          </section>

          {/* Speaking */}
          <section
            id="fluent-speaking"
            className={`rounded-xl border bg-white p-6 shadow-sm ${showGaps && speakingShort ? "border-rose-400 ring-1 ring-rose-300" : ""}`}
          >
            <h2 className="mb-1 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <Mic className="h-5 w-5 text-[#5391D5]" /> {t.speaking}
              <span className="ms-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                {t.required}
              </span>
            </h2>
            <p className="mb-3 text-xs text-slate-500">{t.speakHint}</p>
            <p dir="ltr" className="text-sm text-[#111232]">{test.speaking.prompt_en}</p>
            {rtl && test.speaking.prompt_ar && (
              <p dir="rtl" className="mt-1 text-sm text-slate-600">{test.speaking.prompt_ar}</p>
            )}

            {speakMode === "record" ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {!recording ? (
                    <button onClick={startRecording} disabled={transcribing}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:bg-[#121140] disabled:opacity-50">
                      <Mic className="h-4 w-4" /> {transcript ? t.reRecord : t.record}
                    </button>
                  ) : (
                    <button onClick={stopRecording}
                      className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
                      <Square className="h-4 w-4" /> {t.stop}
                    </button>
                  )}
                  {recording && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-rose-600">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-rose-600" />
                      {t.recording} {recSeconds}s / {test.speaking.min_seconds}s
                    </span>
                  )}
                  {transcribing && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> {t.transcribing}
                    </span>
                  )}
                </div>
                {transcript && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{recording ? t.listening_live : t.yourTranscript}</p>
                    <p dir="ltr" className="text-sm text-[#111232]">{transcript}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={4}
                  onPaste={onPasteCapture}
                  placeholder={t.speakTypeHere} dir="ltr"
                  className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-[#111232] focus:border-[#5391D5] focus:outline-none" />
                <button onClick={() => { setSpeakMode("record"); setSpeakNote(""); }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
                  <Mic className="h-3.5 w-3.5" /> {t.recordInstead}
                </button>
              </div>
            )}
            {speakNote && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-700">
                <AlertCircle className="h-3.5 w-3.5" /> {speakNote}
              </p>
            )}
          </section>

          {/* CAL-FLU-604: when a click is blocked, say exactly what is incomplete
              and let the candidate jump straight to the first gap - no silent block. */}
          {showGaps && hasGaps && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <p className="font-medium">{t.incompleteTitle}</p>
              <ul className="mt-1.5 list-disc space-y-0.5 ps-5 text-xs">
                {unansweredIds.length > 0 && (
                  <li>{unansweredIds.length} {t.nUnanswered}</li>
                )}
                {writingShort && <li>{t.writingTooShort}</li>}
                {speakingShort && <li>{t.speakingNeeded}</li>}
              </ul>
              {unansweredIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => scrollToGap(`fluent-q-${unansweredIds[0]}`)}
                  className="mt-2 text-xs font-semibold text-rose-700 underline hover:text-rose-900"
                >
                  {t.jumpToFirst}
                </button>
              )}
            </div>
          )}
          <button onClick={handleSubmitClick} disabled={busy || transcribing || recording}
            className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {busy ? t.scoring : t.submit}
          </button>
          <p className="mt-2 text-[11px] text-slate-400">{t.proctorNote}</p>
        </>
      )}

      {/* ── Taker thank-you (XP-13: results are not shown to the taker) ── */}
      {phase === "result" && result && !canView && (
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h2 className="mt-3 text-xl font-bold text-[#010131]">
            {rtl ? "تم إرسال تقييمك" : "Your assessment has been submitted"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {rtl
              ? "تمت مشاركة نتائجك مع الجهة الطالبة ولا تُعرض هنا. شكرًا لك."
              : "Your results have been shared with the requesting organisation and are not shown here. Thank you."}
          </p>
          <button onClick={reset} className="mt-5 inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <RotateCcw className="h-4 w-4" /> {t.startOver}
          </button>
        </div>
      )}

      {/* ── Result (staff only) ── */}
      {phase === "result" && result && canView && (
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
          {takerName.trim() && (
            <p className="text-sm text-slate-500">{t.resultFor} <span className="font-semibold text-[#010131]">{takerName.trim()}</span></p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">{t.yourLevel}</p>
              <div className={`mt-1 inline-flex items-center justify-center rounded-xl border-2 px-5 py-3 text-4xl font-bold ${CEFR_TONE[result.overall_cefr]}`}>
                {result.overall_cefr}
              </div>
              {result.reliability && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {t.range}: <span className="font-semibold text-slate-700">{bandText(result.reliability)}</span>
                  {result.reliability.underpowered ? ` · ${t.indicative}` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <ScoreChip label={t.readingScore} main={`${result.reading_correct}/${result.reading_total}`} sub={`${result.reading_cefr} · ${result.reading_correct} ${t.correct}`} />
              {result.listening_total > 0 && (
                <ScoreChip label={t.listeningScore} main={`${result.listening_correct}/${result.listening_total}`} sub={`${result.listening_cefr} · ${result.listening_correct} ${t.correct}`} />
              )}
              <div className="rounded-md border bg-muted/20 p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{t.writingScore}</p>
                <p className={`mt-1 inline-block rounded-md border px-2 text-lg font-bold ${CEFR_TONE[result.writing.cefr]}`}>{result.writing.cefr}</p>
              </div>
              {result.speaking.attempted && (
                <div className="rounded-md border bg-muted/20 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{t.speakingScore}</p>
                  <p className={`mt-1 inline-block rounded-md border px-2 text-lg font-bold ${CEFR_TONE[result.speaking.cefr]}`}>{result.speaking.cefr}</p>
                </div>
              )}
            </div>
          </div>

          {/* Writing criteria + feedback */}
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#010131]"><PenLine className="h-4 w-4 text-[#5391D5]" /> {t.writing}</p>
            <CriteriaBars values={result.writing} keys={["task_achievement", "coherence", "lexical_range", "grammar", "register", "etiquette", "mechanics"] as const} labels={t.writeCrit} />
            <FeedbackBox text_en={result.writing.feedback_en} text_ar={rtl ? result.writing.feedback_ar : null} ai={result.writing.ai_generated} label={t.feedback} />
          </div>

          {/* Speaking criteria + transcript + feedback */}
          {result.speaking.attempted && (
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#010131]"><Mic className="h-4 w-4 text-[#5391D5]" /> {t.speaking}</p>
              <CriteriaBars values={result.speaking} keys={["fluency", "coherence", "lexical_range", "grammar"] as const} labels={t.speakCrit} />
              {typeof result.speaking.pronunciation === "number" && (
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="w-44 shrink-0">{t.pronunciation}</span>
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`h-2 flex-1 rounded-full ${n <= (result.speaking.pronunciation ?? 0) ? "bg-[#5391D5]" : "bg-slate-200"}`} />
                    ))}
                  </div>
                  <span className="w-8 shrink-0 text-right tabular-nums text-slate-500">{result.speaking.pronunciation}/5</span>
                </div>
              )}
              {result.speaking.azure && (
                <p className="mt-1 text-[10px] text-slate-400">
                  {t.azureNote}: accuracy {Math.round(result.speaking.azure.accuracy)} · fluency {Math.round(result.speaking.azure.fluency)}
                  {result.speaking.azure.prosody != null ? ` · prosody ${Math.round(result.speaking.azure.prosody)}` : ""}
                </p>
              )}
              {result.speaking.transcript && (
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t.transcriptHeading}</p>
                  <p dir="ltr" className="text-sm text-[#111232]">{result.speaking.transcript}</p>
                </div>
              )}
              <FeedbackBox text_en={result.speaking.feedback_en} text_ar={rtl ? result.speaking.feedback_ar : null} ai={result.speaking.ai_generated} label={t.feedback} />
            </div>
          )}

          {/* CAL-FLU-601: advisory integrity signal, candidate-facing. Never
              affects the level or auto-fails - framed as advisory throughout. */}
          {(() => {
            const integrity =
              result.integrity ??
              computeIntegritySignal({ blurCount, pasteCount, awayMs, pasteChars, events });
            const tone =
              integrity.tier === "elevated"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : integrity.tier === "minor"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800";
            return (
              <div className={`rounded-lg border p-4 text-sm ${tone}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    {t.integrityHeading}: {t.integrityTier[integrity.tier]}
                  </span>
                  <span className="text-xs opacity-70 tabular-nums">{integrity.score}/100</span>
                </div>
                <ul className="mt-1.5 list-disc ps-5 text-xs">
                  {integrity.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] opacity-70">{t.integrityNote}</p>
              </div>
            );
          })()}

          <FluentDefinitions ar={rtl} />

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={reset}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <RotateCcw className="h-4 w-4" /> {t.startOver}
            </button>
            {result.result_id && (
              <>
                <a href={`/api/ac/fluent/${result.result_id}/report`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-[#010131] px-4 py-2 text-sm font-semibold text-white hover:bg-[#121140]">
                  <Award className="h-4 w-4" /> {rtl ? "تنزيل التقرير الكامل" : "Download full report"}
                </a>
                <a href={`/api/ac/fluent/${result.result_id}/certificate?format=pdf`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-[#5391D5] px-4 py-2 text-sm font-semibold text-[#5391D5] hover:bg-[#5391D5]/10">
                  {rtl ? "الشهادة" : "Certificate"}
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── small presentational helpers ────────────────────────────────
function Options({
  item, answers, setAnswers,
}: {
  item: { id: string; options: string[] };
  answers: Record<string, number>;
  setAnswers: Dispatch<SetStateAction<Record<string, number>>>;
}) {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2" dir="ltr">
      {item.options.map((opt, oi) => (
        <label key={oi} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
          answers[item.id] === oi ? "border-[#5391D5] bg-[#5391D5]/5" : "border-slate-200 hover:bg-slate-50"
        }`}>
          <input type="radio" name={item.id} checked={answers[item.id] === oi}
            onChange={() => setAnswers((a) => ({ ...a, [item.id]: oi }))}
            className="accent-[#5391D5]" />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

function ScoreChip({ label, main, sub }: { label: string; main: string; sub: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{main}</p>
      <p className="text-[10px] text-slate-500">{sub}</p>
    </div>
  );
}

function CriteriaBars<K extends string>({
  values, keys, labels,
}: {
  values: Record<K, number>;
  keys: readonly K[];
  labels: Record<K, string>;
}) {
  return (
    <div className="space-y-2">
      {keys.map((k) => {
        const v = values[k];
        return (
          <div key={k} className="flex items-center gap-3 text-xs">
            <span className="w-44 shrink-0">{labels[k]}</span>
            <div className="flex flex-1 gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`h-2 flex-1 rounded-full ${n <= v ? "bg-[#5391D5]" : "bg-slate-200"}`} />
              ))}
            </div>
            <span className="w-8 shrink-0 text-right tabular-nums text-slate-500">{v}/5</span>
          </div>
        );
      })}
    </div>
  );
}

function FeedbackBox({ text_en, text_ar, ai, label }: { text_en: string; text_ar: string | null; ai: boolean; label: string }) {
  return (
    <div className="mt-3 rounded-md border border-[#5391D5]/30 bg-[#5391D5]/5 p-4">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#5391D5]">{label}</p>
      <p dir="ltr" className="text-sm leading-relaxed text-[#111232]">{text_en}</p>
      {text_ar && <p dir="rtl" className="mt-2 text-sm leading-relaxed text-[#111232]">{text_ar}</p>}
      {!ai && <p className="mt-1 text-[10px] text-amber-600">fallback score (no AI key)</p>}
    </div>
  );
}
