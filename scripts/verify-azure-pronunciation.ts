/**
 * Verify the Azure pronunciation-assessment path end-to-end WITHOUT a mic.
 *
 *   npx tsx scripts/verify-azure-pronunciation.ts
 *
 * It synthesizes a sample sentence with Azure neural TTS, transcodes the MP3
 * to 16 kHz mono PCM WAV via the same ffmpeg call the transcribe route uses,
 * then runs assessPronunciation() on it. Because the input is clean TTS speech,
 * the returned scores should be high — the point is to prove the STT
 * pronunciation endpoint is reachable and returns accuracy/fluency/prosody,
 * which is exactly the data that drives the Pronunciation row on the result.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), true);

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FFMPEG_BIN = process.env.FFMPEG_BIN || "ffmpeg";

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

async function main() {
  const { isAzureSpeechConfigured, synthesizeSpeech, assessPronunciation } = await import(
    "../src/lib/integrations/speech"
  );
  console.log("Azure Speech configured:", isAzureSpeechConfigured());
  if (!isAzureSpeechConfigured()) {
    console.log("→ Set AZURE_SPEECH_KEY + AZURE_SPEECH_REGION in .env.local, then re-run.");
    return;
  }

  const sample =
    "I would like to improve my English to advance my career and work confidently with international colleagues.";
  const mp3 = await synthesizeSpeech(sample);
  if (!mp3) {
    console.log("Neural TTS: ✗ FAILED — cannot produce sample audio (check key/region/connectivity).");
    return;
  }
  console.log(`Neural TTS sample: ✓ ${mp3.length} bytes (mp3)`);

  const dir = await mkdtemp(join(tmpdir(), "vifm-pron-"));
  try {
    const mp3Path = join(dir, `${randomUUID()}.mp3`);
    const wavPath = join(dir, `${randomUUID()}.wav`);
    await writeFile(mp3Path, mp3);

    const ok = await transcodeToWav(mp3Path, wavPath);
    if (!ok) {
      console.log("ffmpeg transcode: ✗ FAILED — is ffmpeg on PATH? (set FFMPEG_BIN to override)");
      return;
    }
    const wav = await readFile(wavPath);
    console.log(`ffmpeg → WAV: ✓ ${wav.length} bytes (16 kHz mono PCM)`);

    const pron = await assessPronunciation(wav);
    if (!pron) {
      console.log("Pronunciation: ✗ FAILED — no score returned (endpoint reset or nothing recognized).");
      return;
    }
    console.log("Pronunciation: ✓ OK");
    console.log(
      `  accuracy=${pron.accuracy}  fluency=${pron.fluency}  completeness=${pron.completeness}` +
        `  prosody=${pron.prosody ?? "n/a"}  overall(pron)=${pron.pron}`
    );
    console.log("→ This is the data that renders the Pronunciation row on a real speaking submission.");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
