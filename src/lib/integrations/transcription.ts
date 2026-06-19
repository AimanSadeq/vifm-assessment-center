/**
 * Speech-to-text for spoken assessment answers + optional Azure acoustic
 * pronunciation scoring. Shared by the Fluent placement test and the Pre-Hire
 * English screen so both go through ONE code path.
 *
 * Transcript backend, in order of preference:
 *   1. OpenAI Whisper API (OPENAI_API_KEY) - hosted; the only path that works on
 *      Render, where Python/faster-whisper/ffmpeg aren't installed. Accepts the
 *      browser's WebM/Opus blob directly (no transcode).
 *   2. Local Whisper subprocess (scripts/whisper-transcribe.py) - dev fallback
 *      when no hosted key is set.
 * Pronunciation (Azure) is best-effort and needs a 16 kHz WAV via ffmpeg; it
 * degrades to transcript-only when ffmpeg/Azure aren't available. No audio
 * persisted - temp files are cleaned up.
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isAzureSpeechConfigured,
  assessPronunciation,
  type PronunciationScore,
} from "@/lib/integrations/speech";

const PYTHON_BIN = process.env.PYTHON_BIN || "python";
const FFMPEG_BIN = process.env.FFMPEG_BIN || "ffmpeg";
const SCRIPT = join(process.cwd(), "scripts", "whisper-transcribe.py");
const TIMEOUT_MS = 180_000;
const MAX_BYTES = 25 * 1024 * 1024;

// Hosted STT (OpenAI Whisper). Preferred in production (Render) where the local
// Python/faster-whisper/ffmpeg toolchain isn't available; the API accepts the
// browser's WebM/Opus blob directly, so no audio transcoding is needed.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_STT_MODEL = process.env.OPENAI_STT_MODEL || "whisper-1";

function isOpenAITranscribeConfigured(): boolean {
  const k = OPENAI_API_KEY;
  return !!(k && k.trim().length > 0 && !/[<>]/.test(k));
}

/** Transcribe a recorded blob via the OpenAI audio-transcriptions API. */
async function transcribeWithOpenAI(file: Blob): Promise<{ transcript?: string; error?: string }> {
  if (!OPENAI_API_KEY) return { error: "OpenAI not configured" };
  try {
    const ext = extFromType(file.type || "");
    const form = new FormData();
    // Filename extension lets the API infer the container (webm/ogg/mp4/wav…).
    form.append("file", file, `speech.${ext}`);
    form.append("model", OPENAI_STT_MODEL);
    form.append("language", "en"); // Fluent content is English - bias the decode
    form.append("response_format", "json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { error: `OpenAI STT ${res.status}: ${detail.slice(0, 200)}` };
    }
    const json = (await res.json()) as { text?: string };
    return { transcript: typeof json.text === "string" ? json.text.trim() : "" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "OpenAI STT failed" };
  }
}

export type TranscriptionResult = {
  transcript?: string;
  pronunciation?: PronunciationScore | null;
  error?: string;
  /** Suggested HTTP status when `error` is set. */
  status?: number;
};

function extFromType(type: string): string {
  if (type.includes("webm")) return "webm";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) return "mp4";
  if (type.includes("wav")) return "wav";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  return "webm";
}

function runWhisper(audioPath: string): Promise<{ transcript?: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(PYTHON_BIN, [SCRIPT, audioPath], {
      cwd: process.cwd(),
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({ error: "transcription timed out" });
    }, TIMEOUT_MS);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ error: `could not start Whisper: ${err.message}` });
    });
    child.on("close", () => {
      clearTimeout(timer);
      // The script prints exactly one JSON line; grab the last {...} block.
      const match = stdout.trim().match(/\{[\s\S]*\}\s*$/);
      if (!match) {
        resolve({ error: stderr.trim().slice(0, 300) || "no transcript produced" });
        return;
      }
      try {
        resolve(JSON.parse(match[0]) as { transcript?: string; error?: string });
      } catch {
        resolve({ error: "unparsable transcription output" });
      }
    });
  });
}

/** Transcode any ffmpeg-decodable audio to 16 kHz mono PCM WAV (for Azure). */
function transcodeToWav(input: string, output: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(FFMPEG_BIN, ["-y", "-i", input, "-ar", "16000", "-ac", "1", "-f", "wav", output], {
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 30_000);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

/**
 * Transcribe a recorded audio blob and (best-effort) score pronunciation.
 * Returns a structured result with a suggested HTTP status on failure so the
 * calling route can map it directly.
 */
export async function transcribeSpeechFile(file: Blob): Promise<TranscriptionResult> {
  if (!(file instanceof Blob) || file.size === 0) {
    return { error: "missing audio file", status: 400 };
  }
  if (file.size > MAX_BYTES) {
    return { error: "audio too large (max 25MB)", status: 413 };
  }

  // ── 1) Transcript ──
  // Prefer the hosted STT (OpenAI Whisper) so transcription works on Render,
  // where the local Python/Whisper/ffmpeg toolchain isn't installed. Fall back
  // to the local Whisper subprocess only when no hosted key is set (dev).
  let transcript: string | undefined;
  let lastError: string | undefined;
  if (isOpenAITranscribeConfigured()) {
    const r = await transcribeWithOpenAI(file);
    if (typeof r.transcript === "string") transcript = r.transcript;
    else lastError = r.error;
  }

  let dir: string | null = null;
  try {
    if (transcript == null) {
      dir = await mkdtemp(join(tmpdir(), "vifm-fluent-"));
      const audioPath = join(dir, `${randomUUID()}.${extFromType(file.type || "")}`);
      await writeFile(audioPath, Buffer.from(await file.arrayBuffer()));
      const r = await runWhisper(audioPath);
      if (typeof r.transcript === "string") transcript = r.transcript;
      else lastError = r.error ?? lastError;
    }

    if (typeof transcript !== "string") {
      return { error: lastError || "transcription failed", status: 422 };
    }

    // ── 2) Pronunciation (Azure) - best-effort ──
    // Needs a 16 kHz WAV (ffmpeg). On Render without ffmpeg this returns null
    // and we ship transcript-only, exactly as before.
    let pronunciation: PronunciationScore | null = null;
    if (isAzureSpeechConfigured()) {
      try {
        if (!dir) dir = await mkdtemp(join(tmpdir(), "vifm-fluent-"));
        const srcPath = join(dir, `${randomUUID()}.${extFromType(file.type || "")}`);
        await writeFile(srcPath, Buffer.from(await file.arrayBuffer()));
        const wavPath = join(dir, `${randomUUID()}.wav`);
        if (await transcodeToWav(srcPath, wavPath)) {
          pronunciation = await assessPronunciation(await readFile(wavPath));
        }
      } catch {
        pronunciation = null;
      }
    }

    return { transcript, pronunciation };
  } catch (err) {
    console.error("[transcription] failed:", err);
    return { error: "internal transcription error", status: 500 };
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
