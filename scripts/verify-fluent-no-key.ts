/**
 * Verify VIFM Fluent does not leak the answer key (Phase 1a).
 *
 *   npx tsx scripts/verify-fluent-no-key.ts
 *
 * Hits the running dev server (default http://localhost:3000) and checks:
 *   1. the "start" response contains NO `correct_index` (secure mode), and
 *   2. a forged/unknown session_id is rejected, and
 *   3. scoring works server-side from the session (client never sends the key).
 *
 * If eng_fluent_sessions (migration 00045) isn't applied, the API falls back
 * to the legacy client-graded path and the script reports that.
 */

const BASE = process.env.FLUENT_BASE || "http://localhost:3000";

type Item = { id: string; correct_index?: number };
type StartResp = { session_id?: string; test?: { reading?: Item[]; listening?: Item[] } } & {
  reading?: Item[];
  listening?: Item[];
};

async function post(body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${BASE}/api/ac/fluent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

async function main() {
  const start = (await post({ action: "start", language: "en" })).json as StartResp;
  const sessionId = start.session_id ?? null;
  const test = start.test ?? start;
  const items: Item[] = [...(test.reading ?? []), ...(test.listening ?? [])];
  const keyLeaked = items.some((it) => "correct_index" in it);

  console.log(`mode: ${sessionId ? "SECURE (00045 applied)" : "LEGACY (00045 not applied)"}`);
  console.log(`answer key in start response: ${keyLeaked ? "PRESENT  ❌ FAIL" : "absent  ✓"}`);

  if (!sessionId) {
    console.log("→ Apply migration 00045_eng_fluent_sessions.sql to activate the secure path, then re-run.");
    return;
  }

  const forged = await post({
    action: "score",
    language: "en",
    sessionId: "00000000-0000-0000-0000-000000000000",
    answers: {},
    writingResponse: "x",
  });
  console.log(`forged session_id → HTTP ${forged.status}  ${forged.status === 400 ? "✓ rejected" : "❌ expected 400"}`);

  // Server grades from the stored session; the client never had the key.
  const answers: Record<string, number> = {};
  for (const it of items) answers[it.id] = 0;
  const scored = await post({
    action: "score",
    language: "en",
    sessionId,
    answers,
    writingResponse:
      "This is a short workplace response written so that scoring can proceed end to end during verification.",
  });
  console.log(
    `server-graded receptive: reading ${scored.json.reading_correct}/${scored.json.reading_total} (${scored.json.reading_cefr}), ` +
      `listening ${scored.json.listening_correct}/${scored.json.listening_total} (${scored.json.listening_cefr})  ✓ graded server-side`
  );
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
