import { NextResponse } from "next/server";
import { submitSession } from "@/lib/technical-sandbox/service";
import { emailSessionResults } from "@/lib/technical-sandbox/results-email";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  try {
    const result = await submitSession(params.token);
    // On a fresh submit (not an already-submitted replay), email the candidate
    // their results + PDF. submitSession returns { session, score } only on the
    // real transition; an already-submitted call returns the raw row (no score).
    // emailSessionResults is best-effort and never throws.
    if (result && typeof result === "object" && "score" in result) {
      await emailSessionResults(params.token);
    }
    return NextResponse.json({ ok: true, result });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
