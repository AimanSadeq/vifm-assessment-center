import { NextResponse } from "next/server";
import { saveResponse } from "@/lib/technical-sandbox/service";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const body = await req.json();
    if (!body?.skillBlockId) return NextResponse.json({ ok: false, error: "skillBlockId required" }, { status: 400 });
    await saveResponse(params.token, body.skillBlockId, body.work ?? {});
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
