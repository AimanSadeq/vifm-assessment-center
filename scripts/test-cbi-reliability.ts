/**
 * Pre-Hire AI Interview (CBI) reliability probe.
 *
 *   npx tsx scripts/test-cbi-reliability.ts
 *
 * Replicates the EXACT LLM call nextInterviewerTurn() makes (same model,
 * max_tokens, prompt shape) and fires it 10x per pass so we can measure how
 * often the Anthropic API hiccups (HTTP 529 "overloaded_error") - the cause of
 * the "Sorry - a brief hiccup" loop candidates were seeing.
 *
 * Pass A uses the CURRENT production retry config (SDK default maxRetries = 2).
 * Pass B uses the proposed hardened config (maxRetries = 8) so we can quantify
 * the improvement before shipping it. No DB writes; read-only against the API.
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const get = (k: string) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
};

const apiKey = get("ANTHROPIC_API_KEY");
if (!apiKey) {
  console.error("No ANTHROPIC_API_KEY in .env.local - cannot probe.");
  process.exit(1);
}

const AI_MODEL = "claude-sonnet-4-5-20250929"; // mirrors src/lib/ai/client.ts

const system =
  `You are a VIFM competency-based interviewer running a structured behavioural (STAR) interview ` +
  `for a single competency. Conduct the entire interview in English.\n` +
  `Rules:\n- Ask EXACTLY ONE question per turn. Keep it to 1-3 sentences.\n` +
  `- Open with a behavioural question ("Tell me about a time when...").\n` +
  `- Be warm, professional and concise. Output ONLY the interviewer's next line.`;
const userMsg =
  `Competency: Graduate Hiring-KAFD - behavioural competency\n` +
  `This is the OPENING question. Ask one strong behavioural question on this competency.`;

type Outcome = { ok: boolean; status?: number; errType?: string; ms: number };

async function oneTurn(client: Anthropic): Promise<Outcome> {
  const t0 = Date.now();
  try {
    const res = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    const block = res.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text) throw new Error("empty turn");
    return { ok: true, ms: Date.now() - t0 };
  } catch (err: unknown) {
    const e = err as { status?: number; error?: { error?: { type?: string } }; message?: string };
    return {
      ok: false,
      status: e.status,
      errType: e.error?.error?.type ?? e.message ?? "unknown",
      ms: Date.now() - t0,
    };
  }
}

async function runPass(label: string, maxRetries: number): Promise<void> {
  const client = new Anthropic({ apiKey, maxRetries });
  const N = 10;
  const results: Outcome[] = [];
  console.log(`\n=== ${label} (maxRetries=${maxRetries}, ${N} turns) ===`);
  for (let i = 0; i < N; i++) {
    const r = await oneTurn(client);
    results.push(r);
    const tag = r.ok ? "OK " : `FAIL ${r.status ?? ""} ${r.errType ?? ""}`;
    console.log(`  turn ${String(i + 1).padStart(2)}: ${tag.padEnd(28)} ${r.ms} ms`);
  }
  const ok = results.filter((r) => r.ok).length;
  const overloaded = results.filter((r) => !r.ok && (r.status === 529 || r.errType === "overloaded_error")).length;
  const avgMs = Math.round(results.reduce((s, r) => s + r.ms, 0) / N);
  console.log(`  ---`);
  console.log(`  SUCCESS ${ok}/${N}  |  overloaded(529) ${overloaded}  |  other-fail ${N - ok - overloaded}  |  avg ${avgMs} ms`);
}

(async () => {
  console.log(`Probing model ${AI_MODEL} - replicating the CBI opening-turn call.`);
  await runPass("Pass A - CURRENT production config", 2);
  await runPass("Pass B - PROPOSED hardened config", 8);
  console.log("\nDone. 529/overloaded = transient Anthropic capacity throttle (retryable).");
})();
