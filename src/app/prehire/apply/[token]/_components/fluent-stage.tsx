"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  BookOpen, Headphones, PenLine, Mic, Square, Play, Volume2,
  AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { startBrowserStt, type BrowserSttSession } from "@/lib/speech/browser-stt";

/**
 * Full 4-skill English placement stage for the self-served pre-hire flow.
 *
 * Reading + Listening are auto-scored MCQs; Writing + Speaking are Claude-scored
 * (speaking via Whisper transcription, optionally blended with Azure
 * pronunciation). The answer key never reaches the browser — the server holds
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

const ttsAvailable = () =>
  typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export function FluentStage({ token, onDone }: { token: string; onDone: () => void }) {
  const [phase, setPhase] = useState<"intro" | "test">("intro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<FluentTest | null>(null);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [writing, setWriting] = useState("");

  // Lightweight, advisory proctoring (surfaced to recruiters, never auto-fails).
  const [blurCount, setBlurCount] = useState(0);
  const [pasteCount, setPasteCount] = useState(0);

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
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Browser-native speech-to-text (primary path — free, no server, works on Render).
  const sttRef = useRef<BrowserSttSession | null>(null);
  const usingSttRef = useRef(false);

  // Stop TTS + recording if we unmount mid-flow.
  useEffect(() => {
    return () => {
      if (ttsAvailable()) window.speechSynthesis.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      sttRef.current?.abort();
    };
  }, []);

  // Count tab switches / minimises while the test is open (advisory signal).
  useEffect(() => {
    if (phase !== "test") return;
    const onVis = () => { if (document.hidden) setBlurCount((c) => c + 1); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase]);

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

  async function transcribeBlob(blob: Blob) {
    setTranscribing(true);
    setSpeakNote("");
    try {
      const fd = new FormData();
      fd.append("audio", blob, "speaking.webm");
      const res = await fetch(`/api/prehire/${token}/fluent/transcribe`, { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        transcript?: string; error?: string; pronunciation?: PronunciationLike | null;
      };
      if (!res.ok || typeof data.transcript !== "string") {
        setSpeakMode("type");
        setSpeakNote("Transcription didn't work. You can type your answer instead.");
      } else {
        setTranscript(data.transcript);
        setPronunciation(data.pronunciation ?? null);
      }
    } catch {
      setSpeakMode("type");
      setSpeakNote("Transcription didn't work. You can type your answer instead.");
    } finally {
      setTranscribing(false);
    }
  }

  function endTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  async function startRecording() {
    setSpeakNote("");
    // Primary: free, in-browser transcription (no server round-trip, works on
    // Render). The transcript streams in live and flows straight into scoring.
    // Only browsers without the Web Speech API (e.g. Firefox) fall through.
    const stt = startBrowserStt({
      onPartial: (text) => setTranscript(text),
      onDone: (finalText) => {
        endTimer();
        setRecording(false);
        usingSttRef.current = false;
        sttRef.current = null;
        setTranscript(finalText);
        if (!finalText) setSpeakNote("We didn't catch any speech. Please record again.");
      },
      onError: (code) => {
        endTimer();
        setRecording(false);
        usingSttRef.current = false;
        sttRef.current = null;
        setSpeakMode("type");
        setSpeakNote(
          code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture"
            ? "Microphone not available. You can type your answer instead."
            : "Transcription didn't work. You can type your answer instead."
        );
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
      setSpeakNote("Microphone not available. You can type your answer instead.");
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

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/prehire/${token}/fluent/start`, { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { test?: FluentTest; tts?: boolean; done?: boolean; error?: string };
      if (d.done) return onDone();
      if (!res.ok || !d.test) return setError(d.error || "Couldn't start the English test.");
      setTest({ ...d.test, tts: d.tts });
      setPhase("test");
    } catch {
      setError("Couldn't start the English test.");
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
          integrityFlags: { blurCount, pasteCount },
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        return setError(d.error || "Couldn't submit the English test.");
      }
      onDone();
    } catch {
      setError("Couldn't submit the English test.");
    } finally {
      setBusy(false);
    }
  };

  const receptive = test ? [...test.reading, ...test.listening] : [];
  const allAnswered = receptive.length > 0 && receptive.every((r) => answers[r.id] != null);
  // Only require a productive response when that skill was actually served
  // (CAL-PRE-503 partial placement).
  const writingOk = !test?.writing || wordCount(writing) >= MIN_WORDS;
  const speakingOk = !test?.speaking || wordCount(transcript) >= MIN_WORDS;
  const canSubmit =
    allAnswered &&
    writingOk &&
    speakingOk &&
    !transcribing &&
    !recording;

  return (
    <div className="space-y-4" dir="ltr">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {phase === "intro" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="font-semibold text-[#010131]">English placement</h2>
            <p className="text-sm text-muted-foreground">
              A short English test across four skills — reading, listening, writing and speaking.
              About 15 minutes. You&apos;ll read short passages, listen to clips and answer, write a
              brief response, and speak for about 45 seconds. Integrity monitoring is on (tab
              switches and pasting are recorded).
            </p>
            <Button onClick={start} disabled={busy} className="w-full">
              {busy ? "Starting…" : "Start English test"}
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === "test" && test && (
        <>
          {/* Reading (rendered only when the skill was administered) */}
          {test.reading.length > 0 && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <BookOpen className="h-5 w-5 text-[#5391D5]" /> Reading
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
              <Headphones className="h-5 w-5 text-[#5391D5]" /> Listening
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Listen, then answer. You can replay each clip up to twice.
            </p>
            {!test.tts && !ttsAvailable() && (
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                <AlertCircle className="h-3.5 w-3.5" />
                Audio playback isn&apos;t available here — the script is shown so you can still answer.
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
                        <audio
                          controls
                          preload="none"
                          className="h-9 w-full max-w-xs"
                          src={`/api/prehire/${token}/fluent/tts?item=${encodeURIComponent(item.id)}`}
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
              <PenLine className="h-5 w-5 text-[#5391D5]" /> Writing
            </h2>
            <p className="text-sm text-[#111232]">{test.writing.prompt_en}</p>
            <textarea
              value={writing}
              onChange={(e) => setWriting(e.target.value)}
              onPaste={() => setPasteCount((c) => c + 1)}
              rows={7}
              placeholder="Write your response here…"
              className="mt-3 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-[#111232] focus:border-[#5391D5] focus:outline-none focus:ring-2 focus:ring-[#5391D5]/20"
            />
            <div className={`mt-1 text-[11px] ${wordCount(writing) >= test.writing.min_words ? "font-semibold text-emerald-600" : "text-slate-500"}`}>
              {wordCount(writing)} words · min {test.writing.min_words}
            </div>
          </section>
          )}

          {/* Speaking (rendered only when the skill was administered) */}
          {test.speaking && (
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-1 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <Mic className="h-5 w-5 text-[#5391D5]" /> Speaking
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              Record about {test.speaking.min_seconds} seconds. We transcribe your speech and assess it.
            </p>
            <p className="text-sm text-[#111232]">{test.speaking.prompt_en}</p>

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
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  onPaste={() => setPasteCount((c) => c + 1)}
                  rows={4}
                  placeholder="Type roughly what you would say…"
                  className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-[#111232] focus:border-[#5391D5] focus:outline-none focus:ring-2 focus:ring-[#5391D5]/20"
                />
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
            {busy ? "Submitting…" : "Submit & continue"}
          </Button>
          <p className="text-center text-[11px] text-slate-400">
            Integrity monitoring is on — tab switches and pasting are recorded.
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
