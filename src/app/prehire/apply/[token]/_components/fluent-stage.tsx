"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  BookOpen, Headphones, PenLine, Mic, Square, Play, Volume2,
  AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CappedAudio } from "@/components/shared/capped-audio";
import { startBrowserStt, type BrowserSttSession } from "@/lib/speech/browser-stt";
import { type IntegrityEvent } from "@/lib/scoring/integrity";

/**
 * Full 4-skill English placement stage for the self-served pre-hire flow.
 *
 * Reading + Listening are auto-scored MCQs; Writing + Speaking are Claude-scored
 * (speaking via Whisper transcription, optionally blended with Azure
 * pronunciation). The answer key never reaches the browser - the server holds
 * the full test and grades it. Like the quiz + CBI stages, the candidate sees no
 * score here: on submit the server scores it, rolls it into the composite, and
 * we call onDone() to advance. The recruiter sees the result, not the candidate.
 */

type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
type PronunciationLike = {
  accuracy: number; fluency: number; completeness: number; prosody: number | null; pron: number;
};
type ReadingItem = { id: string; passage: string; question: string; options: string[]; cefr: Cefr };
type ListeningItem = { id: string; script?: string; question: string; options: string[]; cefr: Cefr };
type WritingTask = { id: string; prompt_en: string; prompt_ar: string | null; cefr_target: Cefr; min_words: number };
type SpeakingTask = { id: string; prompt_en: string; prompt_ar: string | null; cefr_target: Cefr; min_seconds: number };
// writing / speaking are optional: a requisition can drop a productive skill
// (CAL-PRE-503), so the served test omits them. Sections render conditionally.
type FluentTest = {
  reading: ReadingItem[]; listening: ListeningItem[]; writing?: WritingTask; speaking?: SpeakingTask;
  ai_generated: boolean; tts?: boolean;
};

const MAX_PLAYS = 2;
const MIN_WORDS = 5;
// A modest "real attempt" floor for writing - NOT the full 70-90 target (which
// would hard-block a genuinely low-level candidate whose short answer IS the
// evidence), but enough that a trivially empty response can't slip through.
// Mirrors the Fluent runner (trial: 67 words passed a promised "min 70").
const WRITING_SUBMIT_FLOOR = 20;
// In-progress answers survive an accidental back/refresh (trial: "I tried to go
// back, it took me out and started over"). SessionStorage, per candidate token.
const saveKey = (token: string) => `ph-flu-${token}`;

const ttsAvailable = () =>
  typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export function FluentStage({ token, onDone, lang = "en" }: { token: string; onDone: () => void; lang?: "en" | "ar" }) {
  // The test CONTENT is always English; only the RTL layout + the writing /
  // speaking task INSTRUCTIONS (prompt_ar, already shipped) localise.
  const ar = lang === "ar";
  const tr = (en: string, arText: string) => (ar ? arText : en);
  const [phase, setPhase] = useState<"intro" | "test">("intro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<FluentTest | null>(null);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [writing, setWriting] = useState("");


  // Lightweight, advisory proctoring (CAL-FLU-601; surfaced to recruiters, never
  // auto-fails). PDPL-safe: counts, away-DURATION, and pasted-text LENGTH only.
  const [blurCount, setBlurCount] = useState(0);
  const [pasteCount, setPasteCount] = useState(0);
  const [awayMs, setAwayMs] = useState(0);
  const [pasteChars, setPasteChars] = useState(0);
  const [events, setEvents] = useState<IntegrityEvent[]>([]);
  const testStartRef = useRef<number>(0);

  // Listening playback (browser-TTS fallback path).
  const [plays, setPlays] = useState<Record<string, number>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Speaking.
  const [speakMode, setSpeakMode] = useState<"record" | "type">("record");
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [pronunciation, setPronunciation] = useState<PronunciationLike | null>(null);
  const [speakNote, setSpeakNote] = useState("");

  // Persist in-progress answers so back/refresh resumes instead of wiping
  // (the server already re-serves the same stored test on re-start).
  useEffect(() => {
    if (phase !== "test") return;
    try {
      sessionStorage.setItem(
        saveKey(token),
        JSON.stringify({ answers, writing, typedTranscript: speakMode === "type" ? transcript : "" })
      );
    } catch { /* storage full/blocked - resume is best-effort */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answers, writing, transcript, speakMode, token]);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Browser-native speech-to-text: a live-preview "fast path" that runs IN
  // PARALLEL with an always-on audio recording. Web Speech is unreliable (a
  // network hiccup to the browser's recogniser returns nothing), so the recorded
  // audio is the real source of truth - if Web Speech comes back empty we
  // transcribe the recording on the server instead of dead-ending the candidate.
  const sttRef = useRef<BrowserSttSession | null>(null);
  const sttFinalRef = useRef<string | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const sttSettledRef = useRef(false);
  const recorderSettledRef = useRef(false);
  const finalizedRef = useRef(false);

  // Stop TTS + recording if we unmount mid-flow.
  useEffect(() => {
    return () => {
      if (ttsAvailable()) window.speechSynthesis.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      sttRef.current?.abort();
    };
  }, []);

  // Proctoring (CAL-FLU-601): capture tab-hide / window-blur AWAY DURATION
  // (covers tab switch + minimise AND same-window focus loss like a 2nd monitor),
  // debounced 1.5s, deduped so a tab switch isn't double-counted. Advisory only.
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

  // PDPL-safe paste capture: record the paste + the LENGTH of pasted text only.
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

  // A blob smaller than this almost certainly captured no real audio.
  const MIN_AUDIO_BYTES = 1500;

  /** Server transcription of the recorded audio (OpenAI Whisper on Render).
   *  Returns the transcript on success, or null on any failure. */
  async function transcribeBlob(blob: Blob): Promise<string | null> {
    try {
      const fd = new FormData();
      fd.append("audio", blob, "speaking.webm");
      const res = await fetch(`/api/prehire/${token}/fluent/transcribe`, { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        transcript?: string; pronunciation?: PronunciationLike | null;
      };
      if (!res.ok || typeof data.transcript !== "string") return null;
      setPronunciation(data.pronunciation ?? null);
      return data.transcript.trim();
    } catch {
      return null;
    }
  }

  function endTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  /** Runs once BOTH the live Web-Speech result and the audio recording have
   *  settled. Prefers a solid live transcript; otherwise falls back to
   *  server transcription of the actual recording so a Web-Speech miss never
   *  strands the candidate. Only if BOTH fail do we offer typing. */
  const finalizeSpeaking = useCallback(async () => {
    if (finalizedRef.current) return;
    if (!sttSettledRef.current || !recorderSettledRef.current) return; // wait for both
    finalizedRef.current = true;
    endTimer();
    setRecording(false);

    const sttText = (sttFinalRef.current ?? "").trim();
    const blob = audioBlobRef.current;

    // Fast path: the live browser transcript already has enough - use it, no
    // server round-trip.
    if (wordCount(sttText) >= MIN_WORDS) {
      setTranscript(sttText);
      return;
    }
    // Reliable fallback: transcribe the recording we captured. This rescues the
    // common "Web Speech returned nothing" case that used to dead-end here.
    if (blob && blob.size >= MIN_AUDIO_BYTES) {
      setTranscribing(true);
      const serverText = await transcribeBlob(blob);
      setTranscribing(false);
      if (serverText && wordCount(serverText) >= 1) {
        setTranscript(serverText);
        setSpeakNote("");
        return;
      }
    }
    // Both paths failed. Keep any partial words and guide clearly; the "type
    // instead" affordance stays available so the candidate is never stuck.
    if (sttText) {
      setTranscript(sttText);
      setSpeakNote("We only caught part of your answer. Please record again, or type your answer.");
    } else {
      setSpeakNote("We couldn't hear you. Check your microphone and record again, or type your answer instead.");
    }
    // transcribeBlob only closes over token + stable setters - safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function startRecording() {
    setSpeakNote("");
    setTranscript("");
    setPronunciation(null);
    finalizedRef.current = false;
    sttFinalRef.current = null;
    audioBlobRef.current = null;

    // 1) ALWAYS capture raw audio first - it is the reliable source of truth.
    //    Without a working mic there's nothing to fall back on, so offer typing.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setSpeakMode("type");
      setSpeakNote("Microphone not available. You can type your answer instead.");
      return;
    }
    streamRef.current = stream;

    let hasRecorder = false;
    try {
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
        streamRef.current = null;
        audioBlobRef.current = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" })
          : null;
        recorderSettledRef.current = true;
        void finalizeSpeaking();
      };
      mediaRef.current = mr;
      mr.start();
      hasRecorder = true;
    } catch {
      mediaRef.current = null;
    }
    recorderSettledRef.current = !hasRecorder; // nothing to wait for if no recorder

    // 2) Live browser transcription (preview + fast path), running alongside the
    //    recording. May be unavailable (Firefox) or fail - the recording covers it.
    const stt = startBrowserStt({
      onPartial: (text) => setTranscript(text),
      onDone: (finalText) => {
        sttFinalRef.current = finalText;
        sttRef.current = null;
        sttSettledRef.current = true;
        void finalizeSpeaking();
      },
      onError: () => {
        sttFinalRef.current = sttFinalRef.current ?? "";
        sttRef.current = null;
        sttSettledRef.current = true;
        void finalizeSpeaking();
      },
    });
    if (stt) {
      sttRef.current = stt;
      sttSettledRef.current = false;
    } else {
      sttFinalRef.current = "";
      sttSettledRef.current = true; // no live engine; rely on the recording
    }

    setRecording(true);
    setRecSeconds(0);
    timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
  }

  function stopRecording() {
    // Stop the live transcriber (fires onDone → settles the STT side) and the
    // recorder (fires onstop → settles the recorder side + builds the blob).
    // finalizeSpeaking runs once both have settled.
    if (sttRef.current) {
      try { sttRef.current.stop(); } catch { sttSettledRef.current = true; }
    } else {
      sttSettledRef.current = true;
    }
    const mr = mediaRef.current;
    if (mr && mr.state !== "inactive") {
      try { mr.stop(); } catch { recorderSettledRef.current = true; }
    } else {
      recorderSettledRef.current = true;
    }
    void finalizeSpeaking();
  }

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/prehire/${token}/fluent/start`, { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { test?: FluentTest; tts?: boolean; done?: boolean; error?: string };
      if (d.done) return onDone();
      if (!res.ok || !d.test) return setError(d.error || tr("Couldn't start the English test.", "تعذّر بدء اختبار اللغة الإنجليزية."));
      setTest({ ...d.test, tts: d.tts });
      // Restore any in-progress answers from an interrupted sitting (same test:
      // the server re-serves the stored deck, so the ids still match).
      try {
        const raw = sessionStorage.getItem(saveKey(token));
        if (raw) {
          const saved = JSON.parse(raw) as { answers?: Record<string, number>; writing?: string; typedTranscript?: string };
          if (saved.answers && Object.keys(saved.answers).length > 0) setAnswers(saved.answers);
          if (saved.writing) setWriting(saved.writing);
          if (saved.typedTranscript) { setTranscript(saved.typedTranscript); setSpeakMode("type"); }
        }
      } catch { /* corrupt blob - start clean */ }
      setPhase("test");
    } catch {
      setError(tr("Couldn't start the English test.", "تعذّر بدء اختبار اللغة الإنجليزية."));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!test) return;
    if (ttsAvailable()) window.speechSynthesis.cancel();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/prehire/${token}/fluent/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          writingResponse: writing,
          speakingTranscript: transcript,
          pronunciation,
          integrityFlags: { blurCount, pasteCount, awayMs, pasteChars, events, speakingTyped: speakMode === "type" },
        }),
      });
      // Idempotent completion: if a lost response already completed the stage
      // server-side, a second click must advance, not dead-end on an error
      // (trial: "I had to submit the page twice / it did not allow me to submit").
      if (res.status === 409) {
        try { sessionStorage.removeItem(saveKey(token)); } catch { /* best-effort */ }
        return onDone();
      }
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        return setError(d.error || tr("Couldn't submit the English test.", "تعذّر إرسال اختبار اللغة الإنجليزية."));
      }
      try { sessionStorage.removeItem(saveKey(token)); } catch { /* best-effort */ }
      onDone();
    } catch {
      setError(tr("Couldn't submit the English test.", "تعذّر إرسال اختبار اللغة الإنجليزية."));
    } finally {
      setBusy(false);
    }
  };

  const receptive = test ? [...test.reading, ...test.listening] : [];
  const unanswered = receptive.filter((r) => answers[r.id] == null).length;
  // Only require a productive response when that skill was actually served
  // (CAL-PRE-503 partial placement). The writing gate is the honest floor the
  // label states, not the silent 5-word one the trial caught.
  const writingOk = !test?.writing || wordCount(writing) >= WRITING_SUBMIT_FLOOR;
  const speakingOk = !test?.speaking || wordCount(transcript) >= MIN_WORDS;
  const canSubmit = unanswered === 0 && receptive.length > 0 && writingOk && speakingOk && !transcribing && !recording;
  // Rather than a silently-disabled button, tell the candidate exactly what is
  // missing (trial: "when I finished, it did not allow me to submit").
  const gapHints: string[] = [];
  if (unanswered > 0) gapHints.push(tr(`${unanswered} question${unanswered === 1 ? "" : "s"} unanswered`, `${unanswered} سؤال بلا إجابة`));
  if (test?.writing && !writingOk) gapHints.push(tr(`writing needs at least ${WRITING_SUBMIT_FLOOR} words`, `الكتابة تحتاج ${WRITING_SUBMIT_FLOOR} كلمة على الأقل`));
  if (test?.speaking && !speakingOk) gapHints.push(tr("record or type your speaking answer", "سجّل إجابة التحدّث أو اكتبها"));
  if (recording) gapHints.push(tr("stop the recording first", "أوقف التسجيل أولاً"));
  if (transcribing) gapHints.push(tr("transcription is still finishing", "النسخ الصوتي لم ينتهِ بعد"));

  return (
    <div className="space-y-4" dir={ar ? "rtl" : "ltr"}>
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {phase === "intro" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="font-semibold text-[#010131]">{tr("English placement", "تحديد مستوى اللغة الإنجليزية")}</h2>
            <p className="text-sm text-muted-foreground">
              {tr(
                "A short English test across four skills - reading, listening, writing and speaking. About 15 minutes. You'll read short passages, listen to clips and answer, write a brief response, and speak for about 45 seconds. The test content itself is in English. Integrity monitoring is on (tab switches and pasting are recorded).",
                "اختبار قصير للغة الإنجليزية عبر أربع مهارات - القراءة والاستماع والكتابة والتحدّث. نحو 15 دقيقة. محتوى الاختبار نفسه بالإنجليزية. المراقبة النزاهية مفعّلة (يُسجَّل تبديل التبويبات واللصق)."
              )}
            </p>
            <Button onClick={start} disabled={busy} className="w-full">
              {busy ? tr("Preparing your test - this can take up to a minute…", "جارٍ تجهيز اختبارك - قد يستغرق حتى دقيقة…") : tr("Start English test", "ابدأ اختبار الإنجليزية")}
            </Button>
            {busy && (
              <p className="text-center text-[11px] text-slate-400">
                {tr("Please keep this page open.", "يرجى إبقاء هذه الصفحة مفتوحة.")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {phase === "test" && test && (
        <>
          {/* Reading (rendered only when the skill was administered) */}
          {test.reading.length > 0 && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <BookOpen className="h-5 w-5 text-[#5391D5]" /> {tr("Reading", "القراءة")}
            </h2>
            <div className="space-y-5">
              {test.reading.map((item, i) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm text-[#111232]">{item.passage}</p>
                  <p className="mt-2 text-sm font-semibold text-[#010131]">{i + 1}. {item.question}</p>
                  <Options item={item} answers={answers} setAnswers={setAnswers} />
                </div>
              ))}
            </div>
          </section>
          )}

          {/* Listening (rendered only when the skill was administered) */}
          {test.listening.length > 0 && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-1 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <Headphones className="h-5 w-5 text-[#5391D5]" /> {tr("Listening", "الاستماع")}
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              {tr("Listen, then answer. You can replay each clip up to twice.", "استمع ثم أجب. يمكنك إعادة تشغيل كل مقطع مرتين كحد أقصى.")}
            </p>
            {!test.tts && !ttsAvailable() && (
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                <AlertCircle className="h-3.5 w-3.5" />
                Audio playback isn&apos;t available here - the script is shown so you can still answer.
              </div>
            )}
            <div className="space-y-5">
              {test.listening.map((item, i) => {
                const used = plays[item.id] ?? 0;
                const isPlaying = playingId === item.id;
                return (
                  <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      {test.tts ? (
                        <CappedAudio
                          src={`/api/prehire/${token}/fluent/tts?item=${encodeURIComponent(item.id)}`}
                          persistKey={`ph-${token}:${item.id}`}
                          maxPlays={MAX_PLAYS}
                          playLabel={tr("Play", "تشغيل")}
                          playingLabel={tr("Playing…", "قيد التشغيل…")}
                          replaysLeft={tr("replays left", "إعادة متبقية")}
                        />
                      ) : ttsAvailable() ? (
                        <>
                          <button
                            onClick={() => playClip(item)}
                            disabled={used >= MAX_PLAYS || isPlaying}
                            className="inline-flex items-center gap-1.5 rounded-md bg-[#5391D5] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4380c4] disabled:opacity-50"
                          >
                            {isPlaying ? <Volume2 className="h-3.5 w-3.5 animate-pulse" /> : <Play className="h-3.5 w-3.5" />}
                            {isPlaying ? "Playing…" : "Play"}
                          </button>
                          <span className="text-[11px] text-slate-400">{Math.max(0, MAX_PLAYS - used)} replays left</span>
                        </>
                      ) : (
                        <p className="text-sm italic text-slate-600">“{item.script}”</p>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[#010131]">{i + 1}. {item.question}</p>
                    <Options item={item} answers={answers} setAnswers={setAnswers} />
                  </div>
                );
              })}
            </div>
          </section>
          )}

          {/* Writing (rendered only when the skill was administered) */}
          {test.writing && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <PenLine className="h-5 w-5 text-[#5391D5]" /> {tr("Writing", "الكتابة")}
            </h2>
            <p className="text-sm text-[#111232]">{ar && test.writing.prompt_ar ? test.writing.prompt_ar : test.writing.prompt_en}</p>
            {/* Explicit, labelled word target so "70-90 words" in the prompt
                can never be misread as a per-section time limit. */}
            <p className="mt-2 text-[11px] font-medium text-slate-500">
              {tr(
                `Target length: about 70-90 words (minimum ${WRITING_SUBMIT_FLOOR} to submit). This is a word count, not a time limit.`,
                `الطول المستهدف: نحو 70-90 كلمة (الحد الأدنى للإرسال ${WRITING_SUBMIT_FLOOR}). هذا عدد كلمات وليس حدًا زمنيًا.`
              )}
            </p>
            <textarea
              value={writing}
              onChange={(e) => setWriting(e.target.value)}
              onPaste={onPasteCapture}
              rows={7}
              placeholder="Write your response here…"
              className="mt-3 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-[#111232] focus:border-[#5391D5] focus:outline-none focus:ring-2 focus:ring-[#5391D5]/20"
            />
            <div className={`mt-1 text-[11px] ${wordCount(writing) >= WRITING_SUBMIT_FLOOR ? "font-semibold text-emerald-600" : "text-slate-500"}`}>
              {wordCount(writing)} {tr("words", "كلمة")} · {tr("min", "الحد الأدنى")} {WRITING_SUBMIT_FLOOR} · {tr("target", "المستهدف")} {test.writing.min_words}+
            </div>
          </section>
          )}

          {/* Speaking (rendered only when the skill was administered) */}
          {test.speaking && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-1 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <Mic className="h-5 w-5 text-[#5391D5]" /> {tr("Speaking", "التحدّث")}
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              {tr(`Record about ${test.speaking.min_seconds} seconds. We transcribe your speech and assess it.`, `سجّل نحو ${test.speaking.min_seconds} ثانية. سننسخ حديثك ونقيّمه.`)}
            </p>
            <p className="text-sm text-[#111232]">{ar && test.speaking.prompt_ar ? test.speaking.prompt_ar : test.speaking.prompt_en}</p>

            {speakMode === "record" ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {!recording ? (
                    <button
                      onClick={startRecording}
                      disabled={transcribing}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:bg-[#121140] disabled:opacity-50"
                    >
                      <Mic className="h-4 w-4" /> {transcript ? "Re-record" : "Record"}
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                    >
                      <Square className="h-4 w-4" /> Stop
                    </button>
                  )}
                  {recording && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-rose-600">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-rose-600" />
                      Recording {recSeconds}s / {test.speaking.min_seconds}s
                    </span>
                  )}
                  {transcribing && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Transcribing your speech…
                    </span>
                  )}
                </div>
                {transcript && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{recording ? "Listening…" : "What we heard"}</p>
                    <p className="text-sm text-[#111232]">{transcript}</p>
                  </div>
                )}
                {!recording && !transcribing && (
                  <button
                    onClick={() => { setSpeakMode("type"); setSpeakNote(""); }}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
                  >
                    <PenLine className="h-3.5 w-3.5" /> Prefer to type? Type your answer instead
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  onPaste={onPasteCapture}
                  rows={4}
                  placeholder="Type roughly what you would say…"
                  className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-[#111232] focus:border-[#5391D5] focus:outline-none focus:ring-2 focus:ring-[#5391D5]/20"
                />
                <div className={`text-[11px] ${wordCount(transcript) >= MIN_WORDS ? "font-semibold text-emerald-600" : "text-slate-500"}`}>
                  {wordCount(transcript)} words · min {MIN_WORDS} to submit
                </div>
                <button
                  onClick={() => { setSpeakMode("record"); setSpeakNote(""); }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
                >
                  <Mic className="h-3.5 w-3.5" /> Record instead
                </button>
              </div>
            )}
            {speakNote && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-700">
                <AlertCircle className="h-3.5 w-3.5" /> {speakNote}
              </p>
            )}
          </section>
          )}

          <Button onClick={submit} disabled={busy || !canSubmit} className="w-full" size="lg">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            {busy
              ? tr("Scoring your test - this can take up to a minute…", "جارٍ تقييم اختبارك - قد يستغرق حتى دقيقة…")
              : tr("Submit & continue", "إرسال ومتابعة")}
          </Button>
          {busy && (
            <p className="text-center text-[11px] text-slate-400">
              {tr("Please keep this page open while we score your answers.", "يرجى إبقاء الصفحة مفتوحة أثناء تقييم إجاباتك.")}
            </p>
          )}
          {!busy && !canSubmit && gapHints.length > 0 && (
            <p className="text-center text-[11px] text-amber-700">
              {tr("To submit: ", "للإرسال: ")}{gapHints.join(tr(" · ", " · "))}
            </p>
          )}
          <p className="text-center text-[11px] text-slate-400">
            {tr("Integrity monitoring is on - tab switches and pasting are recorded.", "المراقبة النزاهية مفعّلة - يُسجَّل تبديل التبويبات واللصق.")}
          </p>
        </>
      )}
    </div>
  );
}

function Options({
  item, answers, setAnswers,
}: {
  item: { id: string; options: string[] };
  answers: Record<string, number>;
  setAnswers: Dispatch<SetStateAction<Record<string, number>>>;
}) {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {item.options.map((opt, oi) => (
        <label
          key={oi}
          className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            answers[item.id] === oi ? "border-[#5391D5] bg-[#5391D5]/5" : "border-slate-200 hover:bg-slate-50"
          }`}
        >
          <input
            type="radio"
            name={item.id}
            checked={answers[item.id] === oi}
            onChange={() => setAnswers((a) => ({ ...a, [item.id]: oi }))}
            className="accent-[#5391D5]"
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}
