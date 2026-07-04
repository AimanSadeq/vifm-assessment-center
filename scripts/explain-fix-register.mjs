/**
 * Fix Register - plain-language explainer.
 *
 * For every commit in src/data/fix-register.generated.json, produces ONE clear,
 * jargon-free sentence a non-technical reader (HR / business stakeholder) can
 * understand, and caches it by commit hash in
 *   src/data/fix-register-explanations.json
 *
 * Cheap + incremental: only commits WITHOUT a cached explanation are sent to the
 * model, in batches, and the cache is written after each batch (crash-safe). Runs
 * before the register generator in "prebuild" (tolerant - skips silently if there
 * is no ANTHROPIC_API_KEY or the model call fails, leaving the raw commit body as
 * the fallback so the build never breaks).
 *
 *   npm run explain:fix-register     # populate / refresh the cache
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const REGISTER = join(ROOT, "src", "data", "fix-register.generated.json");
const CACHE = join(ROOT, "src", "data", "fix-register-explanations.json");

const BATCH = 15;          // commits per model call
const MAX_PER_RUN = 700;   // safety cap on how many to explain in one run
const MODEL = "claude-haiku-4-5-20251001"; // fast + cheap for batch summaries

// Load .env.local for local runs (Render already has the env set). Tolerant.
try { const d = await import("dotenv"); d.config({ path: join(ROOT, ".env.local") }); } catch { /* optional */ }

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.warn("[explain] no ANTHROPIC_API_KEY - skipping (raw commit messages remain the fallback).");
  process.exit(0);
}
if (!existsSync(REGISTER)) {
  console.warn("[explain] register not generated yet - run gen:fix-register first. Skipping.");
  process.exit(0);
}

const register = JSON.parse(readFileSync(REGISTER, "utf8"));
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

// Flatten all commits from the register; keep only those without a cached line.
const all = register.services.flatMap((s) =>
  s.entries.map((e) => ({ hash: e.hash, service: s.label, type: e.type, title: e.title, body: e.explanation })),
);
const todo = all.filter((c) => !cache[c.hash]).slice(0, MAX_PER_RUN);

if (todo.length === 0) {
  console.log(`[explain] cache is current - ${Object.keys(cache).length} explanations, nothing to do.`);
  process.exit(0);
}

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey });

const SYSTEM =
  "You write a plain-English change log for a NON-TECHNICAL audience (HR managers, business " +
  "stakeholders) of VIFM Caliber, a talent-assessment platform. Its assessments include Persona " +
  "(behavioural questionnaire), AR Compass / ARC (AI-readiness), Techno (technical certification), " +
  "Fluent (English placement), Logica (cognitive tests), Reflect 360 (feedback), and Pre-Hire " +
  "(screening). For EACH change, write ONE clear sentence (max ~28 words) that a non-technical " +
  "person understands: what changed and why it matters to them. If it is a bug fix, say what was " +
  "going wrong and that it is now corrected. If it is a new feature, say what is now possible. " +
  "NEVER use code terms, file names, function names, migration numbers, or internal jargon. Do not " +
  "start with 'This commit'. Use plain hyphens, never em dashes. Return ONLY a JSON array of " +
  '{"i": <index>, "plain": "<sentence>"} with one object per change, nothing else.';

function parseArray(text) {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("no JSON array in response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

let done = 0;
for (let b = 0; b < todo.length; b += BATCH) {
  const chunk = todo.slice(b, b + BATCH);
  const payload = chunk.map((c, i) => ({
    i,
    service: c.service,
    type: c.type,
    change: c.title,
    detail: (c.body || "").slice(0, 500),
  }));
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1600,
      system: SYSTEM,
      messages: [{ role: "user", content: `Explain these ${chunk.length} changes:\n\n${JSON.stringify(payload, null, 1)}` }],
    });
    const text = msg.content.map((p) => (p.type === "text" ? p.text : "")).join("");
    const arr = parseArray(text);
    for (const item of arr) {
      const c = chunk[item.i];
      if (c && typeof item.plain === "string" && item.plain.trim()) {
        cache[c.hash] = item.plain.trim().replace(/—/g, "-").replace(/–/g, "-");
      }
    }
    done += chunk.length;
    // Crash-safe: persist after every batch.
    mkdirSync(dirname(CACHE), { recursive: true });
    writeFileSync(CACHE, JSON.stringify(cache, null, 2) + "\n", "utf8");
    console.log(`[explain] ${done}/${todo.length} explained...`);
  } catch (err) {
    console.warn(`[explain] batch ${b / BATCH} failed (${err instanceof Error ? err.message : err}) - skipping.`);
  }
}

console.log(`[explain] done. cache now holds ${Object.keys(cache).length} explanations -> ${CACHE}`);
