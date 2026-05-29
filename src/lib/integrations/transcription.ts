/**
 * Speech-to-text for spoken assessment answers (Whisper) + optional Azure
 * acoustic pronunciation scoring. Shared by the Fluent placement test and the
 * Pre-Hire English screen so both go through ONE code path.
 *
 * Stateless: writes the upload to a temp dir, shells out to
 * scripts/whisper-transcribe.py (faster-whisper, ffmpeg-decoded), optionally
 * transcodes to 16 kHz mono WAV for Azure, then cleans up. No audio persisted.
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

  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "vifm-fluent-"));
    const audioPath = join(dir, `${randomUUID()}.${extFromType(file.type || "")}`);
    await writeFile(audioPath, Buffer.from(await file.arrayBuffer()));

    const result = await runWhisper(audioPath);
    if (result.error || typeof result.transcript !== "string") {
      return { error: result.error || "transcription failed", status: 422 };
    }

    // Acoustic pronunciation scoring (Azure) - best-effort; transcript-only
    // when Azure isn't configured or the assessment fails.
    let pronunciation: PronunciationScore | null = null;
    if (isAzureSpeechConfigured()) {
      try {
        const wavPath = join(dir, `${randomUUID()}.wav`);
        if (await transcodeToWav(audioPath, wavPath)) {
          pronunciation = await assessPronunciation(await readFile(wavPath));
        }
      } catch {
        pronunciation = null;
      }
    }

    return { transcript: result.transcript, pronunciation };
  } catch (err) {
    console.error("[transcription] failed:", err);
    return { error: "internal transcription error", status: 500 };
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
