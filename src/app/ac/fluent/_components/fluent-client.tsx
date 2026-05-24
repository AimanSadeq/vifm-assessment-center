"use client";

import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, Sparkles, RotateCcw, BookOpen, PenLine, CheckCircle2,
  Headphones, Mic, Square, Play, Volume2, Keyboard, Award, AlertCircle,
} from "lucide-react";

type Language = "en" | "ar";
type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

type ReadingItem = {
  id: string; passage: string; question: string; options: string[]; correct_index: number; cefr: Cefr;
};
type ListeningItem = {
  id: string; script: string; question: string; options: string[]; correct_index: number; cefr: Cefr;
};
type WritingTask = {
  id: string; prompt_en: string; prompt_ar: string | null; cefr_target: Cefr; min_words: number;
};
type SpeakingTask = {
  id: string; prompt_en: string; prompt_ar: string | null; cefr_target: Cefr; min_seconds: number;
};
type FluentTest = {
  reading: ReadingItem[]; listening: ListeningItem[]; writing: WritingTask; speaking: SpeakingTask; ai_generated: boolean;
};
type WritingScore = {
  cefr: Cefr; task_achievement: number; coherence: number; lexical_range: number; grammar: number;
  feedback_en: string; feedback_ar: string | null; ai_generated: boolean;
};
type SpeakingScore = {
  attempted: boolean; cefr: Cefr; fluency: number; coherence: number; lexical_range: number; grammar: number;
  transcript: string; feedback_en: string; feedback_ar: string | null; ai_generated: boolean;
};
type FluentResult = {
  overall_cefr: Cefr; reading_correct: number; reading_total: number; reading_cefr: Cefr;
  listening_correct: number; listening_total: number; listening_cefr: Cefr;
  writing: WritingScore; speaking: SpeakingScore; result_id?: string | null;
};

const MAX_PLAYS = 2;

const T = {
  en: {
    start: "Start placement test", starting: "Building your test…",
    reading: "Reading", listening: "Listening", writing: "Writing", speaking: "Speaking",
    words: "words", min: "min", submit: "Submit for scoring", scoring: "Scoring your responses…",
    yourLevel: "Your indicative level", overall: "Overall",
    readingScore: "Reading", listeningScore: "Listening", writingScore: "Writing", speakingScore: "Speaking",
    feedback: "Examiner feedback", startOver: "Start over", correct: "correct",
    writeCrit: { task_achievement: "Task achievement", coherence: "Coherence & cohesion", lexical_range: "Lexical resource", grammar: "Grammar range & accuracy" },
    speakCrit: { fluency: "Fluency", coherence: "Coherence & cohesion", lexical_range: "Lexical resource", grammar: "Grammar range & accuracy" },
    writeHere: "Write your response here…", pickLang: "Test language", target: "Target",
    nameLabel: "Your name (optional)", emailLabel: "Email (optional)",
    namePlaceholder: "e.g. Sara Al Mansoori", emailPlaceholder: "you@example.com",
    listenHint: "Listen, then answer. You can replay each clip up to twice.",
    play: "Play", playing: "Playing…", replaysLeft: "replays left", noTts: "Audio playback isn't available here — the script is shown so you can still answer.",
    speakHint: "Record about 45 seconds. We transcribe your speech and assess it.",
    record: "Record", stop: "Stop", recording: "Recording", transcribing: "Transcribing your speech…",
    yourTranscript: "What we heard", reRecord: "Re-record", typeInstead: "Type instead", recordInstead: "Record instead",
    speakTypeHere: "Type roughly what you would say…", micDenied: "Microphone not available. You can type your answer instead.",
    transcribeFailed: "Transcription didn't work. You can type your answer instead.",
    optional: "optional", certificate: "Download certificate", resultFor: "Result for",
    transcriptHeading: "Your transcript",
  },
  ar: {
    start: "ابدأ اختبار تحديد المستوى", starting: "جارٍ إعداد اختبارك…",
    reading: "القراءة", listening: "الاستماع", writing: "الكتابة", speaking: "التحدث",
    words: "كلمة", min: "الحد الأدنى", submit: "أرسل للتقييم", scoring: "جارٍ تقييم إجاباتك…",
    yourLevel: "مستواك التقريبي", overall: "الإجمالي",
    readingScore: "القراءة", listeningScore: "الاستماع", writingScore: "الكتابة", speakingScore: "التحدث",
    feedback: "ملاحظات المُقيّم", startOver: "ابدأ من جديد", correct: "صحيحة",
    writeCrit: { task_achievement: "تحقيق المهمة", coherence: "الترابط والتماسك", lexical_range: "الثروة اللغوية", grammar: "القواعد ودقتها" },
    speakCrit: { fluency: "الطلاقة", coherence: "الترابط والتماسك", lexical_range: "الثروة اللغوية", grammar: "القواعد ودقتها" },
    writeHere: "اكتب إجابتك هنا…", pickLang: "لغة الاختبار", target: "المستوى المستهدف",
    nameLabel: "اسمك (اختياري)", emailLabel: "البريد الإلكتروني (اختياري)",
    namePlaceholder: "مثال: سارة المنصوري", emailPlaceholder: "you@example.com",
    listenHint: "استمع ثم أجب. يمكنك إعادة تشغيل كل مقطع مرتين كحدٍّ أقصى.",
    play: "تشغيل", playing: "جارٍ التشغيل…", replaysLeft: "إعادة متبقية", noTts: "تشغيل الصوت غير متاح هنا — يظهر النص لتتمكن من الإجابة.",
    speakHint: "سجّل نحو 45 ثانية. نقوم بتفريغ كلامك وتقييمه.",
    record: "تسجيل", stop: "إيقاف", recording: "جارٍ التسجيل", transcribing: "جارٍ تفريغ كلامك…",
    yourTranscript: "ما سمعناه", reRecord: "إعادة التسجيل", typeInstead: "اكتب بدلاً من ذلك", recordInstead: "سجّل بدلاً من ذلك",
    speakTypeHere: "اكتب تقريبًا ما كنت ستقوله…", micDenied: "الميكروفون غير متاح. يمكنك كتابة إجابتك بدلاً من ذلك.",
    transcribeFailed: "تعذّر التفريغ. يمكنك كتابة إجابتك بدلاً من ذلك.",
    optional: "اختياري", certificate: "تنزيل الشهادة", resultFor: "نتيجة",
    transcriptHeading: "نص كلامك",
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

export function FluentClient() {
  const [language, setLanguage] = useState<Language>("en");
  const [phase, setPhase] = useState<"intro" | "test" | "result">("intro");
  const [test, setTest] = useState<FluentTest | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [writing, setWriting] = useState("");
  const [result, setResult] = useState<FluentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Taker identity (self-entered; powers persistence + certificate).
  const [takerName, setTakerName] = useState("");
  const [takerEmail, setTakerEmail] = useState("");

  // Listening playback state.
  const [plays, setPlays] = useState<Record<string, number>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Speaking state.
  const [speakMode, setSpeakMode] = useState<"record" | "type">("record");
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [speakNote, setSpeakNote] = useState("");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const t = T[language];
  const rtl = language === "ar";

  // Stop TTS + recording if the component unmounts mid-flow.
  useEffect(() => {
    return () => {
      if (ttsAvailable()) window.speechSynthesis.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  const playClip = useCallback((item: ListeningItem) => {
    if (!ttsAvailable()) return;
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

  async function startRecording() {
    setSpeakNote("");
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
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
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
      const data = (await res.json()) as { transcript?: string; error?: string };
      if (!res.ok || typeof data.transcript !== "string") {
        setSpeakMode("type");
        setSpeakNote(t.transcribeFailed);
      } else {
        setTranscript(data.transcript);
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
        body: JSON.stringify({ action: "start", language }),
      });
      const data = (await res.json()) as FluentTest;
      setTest(data);
      setAnswers({}); setWriting(""); setResult(null);
      setPlays({}); setPlayingId(null);
      setTranscript(""); setSpeakNote(""); setSpeakMode("record"); setRecSeconds(0);
      setPhase("test");
    } catch {
      setError("Could not build the test. Please try again.");
    } finally { setBusy(false); }
  }

  async function submit() {
    if (!test) return;
    if (ttsAvailable()) window.speechSynthesis.cancel();
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ac/fluent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "score", language,
          reading: test.reading, listening: test.listening, answers,
          writingTask: test.writing, writingResponse: writing,
          speakingTask: test.speaking, speakingTranscript: transcript,
          takerName: takerName.trim() || null, takerEmail: takerEmail.trim() || null,
          aiGenerated: test.ai_generated,
        }),
      });
      const data = (await res.json()) as FluentResult;
      setResult(data); setPhase("result");
    } catch {
      setError("Scoring failed. Please try again.");
    } finally { setBusy(false); }
  }

  function reset() {
    if (ttsAvailable()) window.speechSynthesis.cancel();
    setPhase("intro"); setTest(null); setAnswers({}); setWriting(""); setResult(null); setError("");
    setPlays({}); setPlayingId(null);
    setTranscript(""); setSpeakNote(""); setSpeakMode("record"); setRecSeconds(0);
  }

  const wordCount = writing.trim() ? writing.trim().split(/\s+/).length : 0;
  const receptive = test ? [...test.reading, ...test.listening] : [];
  const allAnswered = receptive.length > 0 && receptive.every((r) => answers[r.id] != null);
  const canSubmit = allAnswered && wordCount >= 5 && !transcribing && !recording;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="space-y-5">
      {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {/* ── Intro ── */}
      {phase === "intro" && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">{t.pickLang}:</span>
            <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
              {(["en", "ar"] as const).map((l) => (
                <button key={l} onClick={() => setLanguage(l)}
                  className={`px-3 py-1.5 text-sm font-medium ${language === l ? "bg-[#5391D5] text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  {l === "en" ? "English" : "العربية"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t.nameLabel}</span>
              <input value={takerName} onChange={(e) => setTakerName(e.target.value)} dir="ltr"
                placeholder={t.namePlaceholder}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#5391D5] focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">{t.emailLabel}</span>
              <input value={takerEmail} onChange={(e) => setTakerEmail(e.target.value)} type="email" dir="ltr"
                placeholder={t.emailPlaceholder}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#5391D5] focus:outline-none" />
            </label>
          </div>

          <button onClick={start} disabled={busy}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#010131] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#121140] disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? t.starting : t.start}
          </button>
        </div>
      )}

      {/* ── Test ── */}
      {phase === "test" && test && (
        <>
          {/* Reading */}
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <BookOpen className="h-5 w-5 text-[#5391D5]" /> {t.reading}
            </h2>
            <div className="space-y-5">
              {test.reading.map((item, i) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                  <p dir="ltr" className="text-sm text-[#111232]">{item.passage}</p>
                  <p dir="ltr" className="mt-2 text-sm font-semibold text-[#010131]">{i + 1}. {item.question}</p>
                  <Options item={item} answers={answers} setAnswers={setAnswers} />
                </div>
              ))}
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
                return (
                  <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      {ttsAvailable() ? (
                        <button onClick={() => playClip(item)} disabled={used >= MAX_PLAYS || isPlaying}
                          className="inline-flex items-center gap-1.5 rounded-md bg-[#5391D5] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4380c4] disabled:opacity-50">
                          {isPlaying ? <Volume2 className="h-3.5 w-3.5 animate-pulse" /> : <Play className="h-3.5 w-3.5" />}
                          {isPlaying ? t.playing : t.play}
                        </button>
                      ) : (
                        <p dir="ltr" className="text-sm italic text-slate-600">“{item.script}”</p>
                      )}
                      {ttsAvailable() && (
                        <span className="text-[11px] text-slate-400">{Math.max(0, MAX_PLAYS - used)} {t.replaysLeft}</span>
                      )}
                    </div>
                    <p dir="ltr" className="mt-3 text-sm font-semibold text-[#010131]">{i + 1}. {item.question}</p>
                    <Options item={item} answers={answers} setAnswers={setAnswers} />
                  </div>
                );
              })}
            </div>
          </section>

          {/* Writing */}
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <PenLine className="h-5 w-5 text-[#5391D5]" /> {t.writing}
              <span className="ms-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {t.target} {test.writing.cefr_target}
              </span>
            </h2>
            <p dir="ltr" className="text-sm text-[#111232]">{test.writing.prompt_en}</p>
            {rtl && test.writing.prompt_ar && (
              <p dir="rtl" className="mt-1 text-sm text-slate-600">{test.writing.prompt_ar}</p>
            )}
            <textarea value={writing} onChange={(e) => setWriting(e.target.value)} rows={7}
              placeholder={t.writeHere} dir="ltr"
              className="mt-3 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-[#111232] focus:border-[#5391D5] focus:outline-none" />
            <div className="mt-1 text-[11px] text-slate-500">
              {wordCount} {t.words} · {t.min} {test.writing.min_words}
            </div>
          </section>

          {/* Speaking */}
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-1 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <Mic className="h-5 w-5 text-[#5391D5]" /> {t.speaking}
              <span className="ms-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {t.optional} · {t.target} {test.speaking.cefr_target}
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
                  <button onClick={() => { setSpeakMode("type"); setSpeakNote(""); }}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
                    <Keyboard className="h-3.5 w-3.5" /> {t.typeInstead}
                  </button>
                </div>
                {transcript && !recording && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t.yourTranscript}</p>
                    <p dir="ltr" className="text-sm text-[#111232]">{transcript}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={4}
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

          <button onClick={submit} disabled={busy || !canSubmit}
            className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {busy ? t.scoring : t.submit}
          </button>
        </>
      )}

      {/* ── Result ── */}
      {phase === "result" && result && (
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
            <CriteriaBars values={result.writing} keys={["task_achievement", "coherence", "lexical_range", "grammar"] as const} labels={t.writeCrit} />
            <FeedbackBox text_en={result.writing.feedback_en} text_ar={rtl ? result.writing.feedback_ar : null} ai={result.writing.ai_generated} label={t.feedback} />
          </div>

          {/* Speaking criteria + transcript + feedback */}
          {result.speaking.attempted && (
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#010131]"><Mic className="h-4 w-4 text-[#5391D5]" /> {t.speaking}</p>
              <CriteriaBars values={result.speaking} keys={["fluency", "coherence", "lexical_range", "grammar"] as const} labels={t.speakCrit} />
              {result.speaking.transcript && (
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t.transcriptHeading}</p>
                  <p dir="ltr" className="text-sm text-[#111232]">{result.speaking.transcript}</p>
                </div>
              )}
              <FeedbackBox text_en={result.speaking.feedback_en} text_ar={rtl ? result.speaking.feedback_ar : null} ai={result.speaking.ai_generated} label={t.feedback} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={reset}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <RotateCcw className="h-4 w-4" /> {t.startOver}
            </button>
            {result.result_id && (
              <a href={`/api/ac/fluent/${result.result_id}/certificate`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-[#5391D5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4380c4]">
                <Award className="h-4 w-4" /> {t.certificate}
              </a>
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
