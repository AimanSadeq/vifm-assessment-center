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
  // A genuinely fatal problem (mic blocked / no device). We stop and report it.
  let fatalError: string | null = null;
  // The last error code seen since the previous restart. "no-speech" is normal
  // (the speaker hasn't started / paused) and must NOT end the session.
  let lastErrorCode: string | null = null;
  // Set true only when the CALLER asks us to stop (the Stop button). Until then
  // a session that ends on its own is a silence pause, and we restart.
  let manualStop = false;
  // Safety ceiling so a persistent failure can't loop forever.
  let restarts = 0;
  const MAX_RESTARTS = 80;

  // Codes that mean "keep listening" rather than "give up": the Web Speech API
  // ends a session after a pause (clean end, no error) or fires "no-speech" when
  // the speaker hasn't started yet. Both should resume listening.
  const isRecoverable = (code: string | null) => code === null || code === "no-speech";

  const finish = () => {
    const text = collapse(finalText);
    if (text) {
      handlers.onDone(text); // use whatever we captured, even after an error
    } else if (fatalError) {
      handlers.onError(fatalError);
    } else if (lastErrorCode && lastErrorCode !== "no-speech" && lastErrorCode !== "aborted") {
      // e.g. "network": nothing captured and the service failed - report it so
      // the caller can offer a retry / type fallback.
      handlers.onError(lastErrorCode);
    } else {
      handlers.onDone(""); // ended cleanly with nothing recognised
    }
  };

  recognizer.onresult = (e) => {
    lastErrorCode = null; // speech is flowing again
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
    lastErrorCode = code;
    // Mic blocked / no capture device is genuinely fatal - the user must grant
    // access or type instead. Everything else (no-speech, aborted, network) is
    // handled in onend, which decides whether to keep listening.
    if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
      fatalError = code;
    }
  };

  recognizer.onend = () => {
    // The Web Speech API stops a session after a short silence even with
    // continuous=true. Unless the caller pressed Stop (or the mic is blocked),
    // resume listening so a thinking pause never cuts the speaker off.
    const shouldRestart =
      !manualStop && !fatalError && isRecoverable(lastErrorCode) && restarts < MAX_RESTARTS;
    if (shouldRestart) {
      restarts += 1;
      lastErrorCode = null;
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
    }
    finish();
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
