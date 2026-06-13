import { NextResponse } from "next/server";
import { submitSession } from "@/lib/technical-sandbox/service";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  try {
    const result = await submitSession(params.token);
    return NextResponse.json({ ok: true, result });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
