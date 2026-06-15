import { NextResponse } from "next/server";
import { submitSession } from "@/lib/technical-sandbox/service";
import { emailSessionResults } from "@/lib/technical-sandbox/results-email";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    // The MCQ knowledge-section answers (item id -> chosen index / indices) ride
    // along on the submit body; the keyed test stays server-side and is graded there.
    let mcqAnswers: Record<string, number | number[]> | null = null;
    try {
      const body = (await req.json()) as { mcqAnswers?: Record<string, number | number[]> } | null;
      if (body && body.mcqAnswers && typeof body.mcqAnswers === "object") {
        mcqAnswers = body.mcqAnswers;
      }
    } catch {
      // No body (sandbox-only submit) - fine.
    }
    const result = await submitSession(params.token, mcqAnswers);
    // Only a fresh transition carries { score, combined }; an already-submitted
    // replay returns { alreadySubmitted: true }. Build an explicit allowlisted
    // DTO so the keyed mcq_test (held only on the session row) can NEVER be
    // serialized to the browser, on either path.
    const isFresh =
      result && typeof result === "object" && "score" in result;
    if (isFresh) {
      // best-effort; never throws
      await emailSessionResults(params.token);
    }
    const safe = isFresh
      ? { score: (result as { score: unknown }).score, combined: (result as { combined: unknown }).combined }
      : { alreadySubmitted: true };
    return NextResponse.json({ ok: true, result: safe });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
