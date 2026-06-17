import { NextResponse } from "next/server";
import { submitSession } from "@/lib/technical-sandbox/service";

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
    // The assessment is scored + persisted server-side, but the candidate must
    // NOT receive results. The response carries only a completion flag - never a
    // score and never the keyed mcq_test. The scored report is a client / VIFM
    // admin deliverable (admin results view + admin-gated PDF); the candidate is
    // not emailed results. (Auto-delivery to a client recipient is a follow-on
    // pending a client-recipient field; today VIFM admin reviews + sends.)
    const isFresh = result && typeof result === "object" && "score" in result;
    const safe = isFresh ? { submitted: true } : { alreadySubmitted: true };
    return NextResponse.json({ ok: true, result: safe });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
