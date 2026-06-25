/**
 * Browser-native speech-to-text (Web Speech API). Free, no API key, runs
 * entirely in the candidate's browser - so Fluent/Pre-Hire speaking transcription
 * works on Render without any server-side Whisper/Python/ffmpeg. Chrome, Edge and
 * Safari support it (`SpeechRecognition` / `webkitSpeechRecognition`); Firefox
 * does not, so callers fall back to server transcription or type-mode.
 *
 * The recognised text flows straight into the existing Claude CEFR scoring - no
 * audio leaves through our server on this path (Chrome streams to its own free
 * recognition service). This is purely a client module: it must only be invoked
 * from `"use client"` components / browser code.
 */

export type BrowserSttHandlers = {
  /** Live transcript (accumulated final + current interim) as the user speaks. */
  onPartial: (text: string) => void;
  /** Final transcript when recognition ends. Empty string = nothing recognised. */
  onDone: (finalText: string) => void;
  /** Non-recoverable error (mic blocked, service unreachable, no mic, …). */
  onError: (code: string) => void;
};

// ── Minimal Web Speech API typings ──────────────────────────────
// lib.dom doesn't ship these across all TS versions, so we declare just the
// surface we use (no `any`).
type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = { isFinal: boolean; 0: SpeechRecognitionAlternativeLike };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionErrorEventLike = { error?: string };
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True when the browser can transcribe speech locally (Chrome/Edge/Safari). */
export function isBrowserSttSupported(): boolean {
  return getCtor() !== null;
}

/** A running browser-STT session. Call stop() to end it (fires onDone/onError). */
export type BrowserSttSession = { stop: () => void; abort: () => void };

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Start browser-native English transcription. Returns null when unsupported (the
 * caller should fall back to server transcription / type-mode). Accumulates final
 * results and streams interim text through onPartial; onDone fires exactly once.
 * If a partial transcript was captured before a fatal error, it's still delivered
 * via onDone rather than discarded.
 */
export function startBrowserStt(handlers: BrowserSttHandlers, lang = "en-US"): BrowserSttSession | null {
  const Ctor = getCtor();
  if (!Ctor) return null;

  let recognizer: SpeechRecognitionLike;
  try {
    recognizer = new Ctor();
  } catch {
    return null;
  }

  recognizer.lang = lang;
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.maxAlternatives = 1;

  let finalText = "";
  // The ONLY thing that truly stops us: the user explicitly denied microphone
  // permission. Everything else - silence pauses, "no-speech", a transient
  // "network"/"audio-capture"/"service-not-allowed", or the engine simply
  // ending a session on its own - is recoverable: we restart and keep listening,
  // so the speaker is NEVER cut off mid-answer and NEVER forced into typing.
  let permissionDenied = false;
  // Set true only when the CALLER asks us to stop (the Stop button).
  let manualStop = false;
  // Restart accounting. emptyStreak counts consecutive sessions that captured no
  // speech at all - that's the only thing that ends listening on its own (a long
  // pure silence, or a tight error loop when the service is genuinely down).
  let restarts = 0;
  let emptyStreak = 0;
  let gotSpeechSinceStart = false;
  const MAX_RESTARTS = 300; // hard backstop
  const MAX_EMPTY_STREAK = 12; // ~ sustained silence / dead-service loop before giving up

  const finish = () => {
    const text = collapse(finalText);
    if (text) {
      handlers.onDone(text); // deliver whatever we captured, even after an error
    } else if (permissionDenied) {
      handlers.onError("not-allowed"); // the one case the caller may offer typing
    } else {
      // Nothing captured, but the mic was NOT blocked - the caller keeps the
      // user in record mode (a gentle "tap Record again" note), never type-mode.
      handlers.onDone("");
    }
  };

  recognizer.onresult = (e) => {
    gotSpeechSinceStart = true;
    emptyStreak = 0;
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      const alt = res[0]?.transcript ?? "";
      if (res.isFinal) finalText += alt + " ";
      else interim += alt;
    }
    handlers.onPartial(collapse(finalText + " " + interim));
  };

  recognizer.onerror = (e) => {
    const code = e?.error ?? "unknown";
    // ONLY an explicit permission denial is fatal. We deliberately do NOT treat
    // "service-not-allowed" / "audio-capture" / "network" / "no-speech" as fatal
    // (those can fire transiently - e.g. in the gap while a session restarts);
    // onend keeps listening through them.
    if (code === "not-allowed") permissionDenied = true;
  };

  recognizer.onend = () => {
    if (manualStop || permissionDenied) {
      finish();
      return;
    }
    if (gotSpeechSinceStart) emptyStreak = 0;
    else emptyStreak += 1;
    if (restarts >= MAX_RESTARTS || emptyStreak >= MAX_EMPTY_STREAK) {
      finish();
      return;
    }
    restarts += 1;
    gotSpeechSinceStart = false;
    try {
      recognizer.start();
      return;
    } catch {
      // Engine still settling (rare InvalidStateError) - retry once shortly,
      // then finish gracefully so we never strand the session.
      setTimeout(() => {
        try {
          recognizer.start();
        } catch {
          finish();
        }
      }, 250);
      return;
    }
  };

  try {
    recognizer.start();
  } catch {
    return null;
  }

  return {
    stop: () => { manualStop = true; try { recognizer.stop(); } catch { /* already stopped */ } },
    abort: () => { manualStop = true; try { recognizer.abort(); } catch { /* already stopped */ } },
  };
}
