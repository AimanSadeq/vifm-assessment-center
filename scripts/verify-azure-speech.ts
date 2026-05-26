/**
 * Verify the Azure AI Speech integration once keys are provisioned.
 *
 *   (set AZURE_SPEECH_KEY + AZURE_SPEECH_REGION in .env.local, then)
 *   npx tsx scripts/verify-azure-speech.ts
 *
 * Checks configuration + neural TTS. Pronunciation assessment is verified
 * end-to-end via the live speaking flow (record at /ac/fluent → the result
 * shows a Pronunciation criterion + raw Azure accuracy/fluency/prosody).
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), true);

async function main() {
  const { isAzureSpeechConfigured, synthesizeSpeech } = await import("../src/lib/integrations/speech");
  console.log("Azure Speech configured:", isAzureSpeechConfigured());
  if (!isAzureSpeechConfigured()) {
    console.log("→ Set AZURE_SPEECH_KEY + AZURE_SPEECH_REGION in .env.local to activate Phase 2, then re-run.");
    return;
  }
  const audio = await synthesizeSpeech("This is a VIFM Fluent listening check.");
  console.log("Neural TTS:", audio ? `✓ OK - ${audio.length} bytes (mp3)` : "✗ FAILED (check key/region)");
  console.log(
    "Pronunciation: record a speaking answer at /ac/fluent - the result should show a Pronunciation row + Azure accuracy/fluency/prosody."
  );
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
