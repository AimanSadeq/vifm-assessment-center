/**
 * Pre-Hire Fluent - speaking-audio transcription (Whisper + optional Azure
 * pronunciation). Token-gated sibling of /api/ac/fluent/transcribe; both share
 * the same engine in @/lib/integrations/transcription. No audio is persisted.
 *
 * POST multipart/form-data with field `audio` -> { transcript, pronunciation }.
 */

import { NextResponse } from "next/server";
import { findCandidateByToken } from "@/lib/prehire/candidate-access";
import { transcribeSpeechFile } from "@/lib/integrations/transcription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ctx = await findCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing audio file" }, { status: 400 });
  }

  const r = await transcribeSpeechFile(file);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status ?? 422 });
  return NextResponse.json({ transcript: r.transcript, pronunciation: r.pronunciation ?? null });
}
