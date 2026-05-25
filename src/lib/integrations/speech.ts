/**
 * Azure AI Speech integration for VIFM Fluent (REST, no SDK dependency).
 *
 *  - synthesizeSpeech(): neural text-to-speech → MP3 bytes, used to voice
 *    listening items (replaces robotic browser SpeechSynthesis; the script
 *    stays server-side so it can't be read as text).
 *  - assessPronunciation(): pronunciation assessment on a WAV → accuracy /
 *    fluency / completeness / prosody / overall scores (0–100), the acoustic
 *    dimension a Whisper transcript can't capture.
 *
 * Both no-op (return null) when AZURE_SPEECH_KEY / AZURE_SPEECH_REGION are
 * absent, so the module is safe to deploy before keys are provisioned — the
 * caller falls back to browser TTS / transcript-only scoring.
 *
 * Env:
 *   AZURE_SPEECH_KEY     — Speech resource key
 *   AZURE_SPEECH_REGION  — e.g. "uaenorth", "westeurope"
 *   AZURE_SPEECH_VOICE   — optional, default "en-US-JennyNeural"
 */

const key = () => process.env.AZURE_SPEECH_KEY;
const region = () => process.env.AZURE_SPEECH_REGION;
const voice = () => process.env.AZURE_SPEECH_VOICE || "en-US-JennyNeural";

// A value is "real" only if non-empty and not a leftover placeholder like
// "<your Azure Speech resource key>" or "<e.g. uaenorth>" (angle brackets or
// whitespace). This prevents a half-broken state where non-empty placeholder
// env values make us think Azure is on, breaking the listening audio instead
// of falling back to browser TTS.
const looksReal = (v?: string): boolean =>
  !!v && v.trim().length > 0 && !/[<>]/.test(v) && !/\s/.test(v.trim());

export function isAzureSpeechConfigured(): boolean {
  return looksReal(key()) && looksReal(region());
}

const escapeXml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/**
 * Neural TTS → MP3 Buffer. Returns null if not configured or on error.
 */
export async function synthesizeSpeech(text: string): Promise<Buffer | null> {
  const k = key();
  const r = region();
  if (!k || !r || !text.trim()) return null;
  const ssml =
    `<speak version='1.0' xml:lang='en-US'>` +
    `<voice name='${escapeXml(voice())}'>${escapeXml(text.slice(0, 2000))}</voice>` +
    `</speak>`;
  try {
    const res = await fetch(`https://${r}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": k,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "vifm-fluent",
      },
      body: ssml,
    });
    if (!res.ok) {
      console.error("[azure-speech] TTS failed:", res.status);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.error("[azure-speech] TTS error:", e);
    return null;
  }
}

export type PronunciationScore = {
  accuracy: number; // 0–100, phoneme accuracy vs native
  fluency: number; // 0–100, pausing/rhythm
  completeness: number; // 0–100, proportion of reference spoken (unscripted ≈ 100)
  prosody: number | null; // 0–100, stress/intonation (null if unavailable)
  pron: number; // 0–100, overall pronunciation score
};

type AzureNBest = {
  PronunciationAssessment?: {
    AccuracyScore?: number;
    FluencyScore?: number;
    CompletenessScore?: number;
    PronScore?: number;
    ProsodyScore?: number;
  };
};

/**
 * Unscripted pronunciation assessment on a 16 kHz mono PCM WAV buffer.
 * Returns null if not configured, on error, or if nothing was recognised.
 */
export async function assessPronunciation(wav: Buffer): Promise<PronunciationScore | null> {
  const k = key();
  const r = region();
  if (!k || !r || wav.length === 0) return null;

  // Unscripted: empty ReferenceText → assessed against what ASR recognises.
  const config = {
    ReferenceText: "",
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    EnableProsodyAssessment: true,
  };
  const header = Buffer.from(JSON.stringify(config), "utf8").toString("base64");

  try {
    const res = await fetch(
      `https://${r}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": k,
          "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
          Accept: "application/json",
          "Pronunciation-Assessment": header,
        },
        body: new Uint8Array(wav),
      }
    );
    if (!res.ok) {
      console.error("[azure-speech] pronunciation failed:", res.status);
      return null;
    }
    const json = (await res.json()) as { NBest?: AzureNBest[] };
    const pa = json.NBest?.[0]?.PronunciationAssessment;
    if (!pa || typeof pa.PronScore !== "number") return null;
    return {
      accuracy: pa.AccuracyScore ?? 0,
      fluency: pa.FluencyScore ?? 0,
      completeness: pa.CompletenessScore ?? 0,
      prosody: typeof pa.ProsodyScore === "number" ? pa.ProsodyScore : null,
      pron: pa.PronScore,
    };
  } catch (e) {
    console.error("[azure-speech] pronunciation error:", e);
    return null;
  }
}
